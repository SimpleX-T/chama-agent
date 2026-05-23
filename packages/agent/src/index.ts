/**
 * ChamaAgent — autonomous ROSCA operator.
 *
 * Watches a single Chama contract and, every TICK_MS:
 *   1. Calls contributeFor() for any member with enough balance + allowance
 *      who hasn't contributed this cycle.
 *   2. Calls executePayout() once the cycle is satisfied (all contributed
 *      OR cycle deadline elapsed).
 *
 * The agent never custodies funds — its private key only signs the workflow
 * calls; the Chama contract enforces all economic invariants on-chain.
 */
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  parseAbi,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import pino from "pino";

const log = pino({
  transport: {
    target: "pino-pretty",
    options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
  },
});

const TICK_MS = Number(process.env.AGENT_TICK_MS ?? 15_000);
let tickInFlight = false;

const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.CELO_SEPOLIA_RPC ?? "https://11142220.rpc.thirdweb.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
});

const chamaAbi = parseAbi([
  "function contribution() view returns (uint256)",
  "function cycleLength() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function currentCycle() view returns (uint256)",
  "function memberCount() view returns (uint256)",
  "function members() view returns (address[])",
  "function currentPayee() view returns (address)",
  "function cycleDeadline() view returns (uint256)",
  "function contributed(uint256 cycle, address member) view returns (bool)",
  "function contributeFor(address member) external",
  "function executePayout() external",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

async function tick(opts: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  chamaAddr: `0x${string}`;
  cUSDAddr: `0x${string}`;
  members: readonly `0x${string}`[];
  contribution: bigint;
  memberCount: bigint;
}) {
  const { publicClient, walletClient, chamaAddr, cUSDAddr, members, contribution, memberCount } = opts;

  const currentCycle = (await publicClient.readContract({
    address: chamaAddr,
    abi: chamaAbi,
    functionName: "currentCycle",
  })) as bigint;

  if (currentCycle >= memberCount) {
    log.info({ cycle: currentCycle.toString() }, "chama completed — agent stopping");
    process.exit(0);
  }

  const contribFlags = await Promise.all(
    members.map((m) =>
      publicClient.readContract({
        address: chamaAddr,
        abi: chamaAbi,
        functionName: "contributed",
        args: [currentCycle, m],
      }) as Promise<boolean>,
    ),
  );

  const uncontributed = members.filter((_, i) => !contribFlags[i]);
  log.info(
    {
      cycle: currentCycle.toString(),
      contributed: contribFlags.filter(Boolean).length,
      of: members.length,
    },
    "tick",
  );

  for (let i = 0; i < members.length; i++) {
    if (contribFlags[i]) continue;
    const m = members[i];
    const [bal, allowance] = (await Promise.all([
      publicClient.readContract({
        address: cUSDAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [m],
      }),
      publicClient.readContract({
        address: cUSDAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [m, chamaAddr],
      }),
    ])) as [bigint, bigint];

    if (bal < contribution || allowance < contribution) {
      log.warn(
        {
          member: m,
          bal: bal.toString(),
          allowance: allowance.toString(),
          need: contribution.toString(),
        },
        "member can't contribute — insufficient balance or allowance; skipping",
      );
      continue;
    }
    log.info({ member: m, cycle: currentCycle.toString() }, "→ contributeFor()");
    const hash = await walletClient.writeContract({
      account: walletClient.account!,
      chain: celoSepolia,
      address: chamaAddr,
      abi: chamaAbi,
      functionName: "contributeFor",
      args: [m],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log.info({ member: m, tx: shortHash(hash) }, "✓ contributeFor mined");
  }

  const updatedFlags = await Promise.all(
    members.map((m) =>
      publicClient.readContract({
        address: chamaAddr,
        abi: chamaAbi,
        functionName: "contributed",
        args: [currentCycle, m],
      }) as Promise<boolean>,
    ),
  );
  const deadline = (await publicClient.readContract({
    address: chamaAddr,
    abi: chamaAbi,
    functionName: "cycleDeadline",
  })) as bigint;
  const allContributed = updatedFlags.every(Boolean);
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (allContributed || now >= deadline) {
    log.info(
      { cycle: currentCycle.toString(), allContributed, deadlinePassed: now >= deadline },
      "→ executePayout()",
    );
    const hash = await walletClient.writeContract({
      account: walletClient.account!,
      chain: celoSepolia,
      address: chamaAddr,
      abi: chamaAbi,
      functionName: "executePayout",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log.info({ cycle: currentCycle.toString(), tx: shortHash(hash) }, "✓ executePayout mined");
  }
}

async function main() {
  const deploymentPath = path.resolve(__dirname, "../../../packages/contracts/deployments/11142220.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required (this is the agent's own key)");
  const account = privateKeyToAccount(pk);

  const chamaAddr = getAddress(deployment.contracts.Chama) as `0x${string}`;
  const cUSDAddr = getAddress(deployment.contracts.cUSD) as `0x${string}`;

  const publicClient = createPublicClient({ chain: celoSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http() });

  const [contribution, memberCount, membersRaw] = await Promise.all([
    publicClient.readContract({
      address: chamaAddr,
      abi: chamaAbi,
      functionName: "contribution",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: chamaAddr,
      abi: chamaAbi,
      functionName: "memberCount",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: chamaAddr,
      abi: chamaAbi,
      functionName: "members",
    }) as Promise<readonly `0x${string}`[]>,
  ]);
  const members = membersRaw.map((m) => getAddress(m) as `0x${string}`);

  log.info(
    {
      agent: account.address,
      chama: chamaAddr,
      cUSD: cUSDAddr,
      contribution: contribution.toString(),
      memberCount: memberCount.toString(),
      tickMs: TICK_MS,
    },
    "ChamaAgent online",
  );

  const opts = { publicClient, walletClient, chamaAddr, cUSDAddr, members, contribution, memberCount };
  const runTick = async () => {
    if (tickInFlight) return; // prevent overlapping reads while a previous tick is mid-tx
    tickInFlight = true;
    try {
      await tick(opts);
    } catch (err) {
      log.error({ err: (err as Error).message }, "tick error");
    } finally {
      tickInFlight = false;
    }
  };
  await runTick();
  setInterval(runTick, TICK_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
