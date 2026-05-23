/**
 * ChamaAgent — autonomous ROSCA operator.
 *
 * Watches one or more Chama contracts (the standalone Chama in
 * deployment.json AND every Chama produced by the ChamaFactory) and,
 * every TICK_MS, drives each active rotation forward:
 *
 *   1. contributeFor(member) — for any member with sufficient cUSD
 *      balance + allowance who hasn't paid in this cycle yet.
 *   2. executePayout() — once all members have paid (or cycle deadline
 *      has elapsed). Pushes the pot to the next payee and advances.
 *
 * The agent never custodies funds — its private key only signs the
 * workflow calls; the Chama contract enforces every economic invariant
 * on-chain.
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
  fallback,
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
const DISCOVER_EVERY_TICKS = 4; // poll factory every ~60s when tick is 15s

const RPC_URLS =
  process.env.CELO_SEPOLIA_RPC?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
    "https://forno.celo-sepolia.celo-testnet.org",
    "https://celo-sepolia.drpc.org",
    "https://11142220.rpc.thirdweb.com",
  ];

const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
});

const rpcTransport = fallback(
  RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
  { rank: false },
);

const chamaAbi = parseAbi([
  "function contribution() view returns (uint256)",
  "function cycleLength() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function currentCycle() view returns (uint256)",
  "function memberCount() view returns (uint256)",
  "function members() view returns (address[])",
  "function cycleDeadline() view returns (uint256)",
  "function contributed(uint256 cycle, address member) view returns (bool)",
  "function contributeFor(address member) external",
  "function executePayout() external",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const factoryAbi = parseAbi([
  "function latestChamas(uint256 limit) view returns (address[])",
]);

function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

type ChamaConfig = {
  address: `0x${string}`;
  contribution: bigint;
  memberCount: bigint;
  members: `0x${string}`[];
  completed: boolean;
};

const watched = new Map<`0x${string}`, ChamaConfig>();
let tickInFlight = false;
let tickCount = 0;

async function loadConfig(
  publicClient: PublicClient,
  address: `0x${string}`,
): Promise<ChamaConfig> {
  const [contribution, memberCount, membersRaw, currentCycle] = (await Promise.all([
    publicClient.readContract({ address, abi: chamaAbi, functionName: "contribution" }),
    publicClient.readContract({ address, abi: chamaAbi, functionName: "memberCount" }),
    publicClient.readContract({ address, abi: chamaAbi, functionName: "members" }),
    publicClient.readContract({ address, abi: chamaAbi, functionName: "currentCycle" }),
  ])) as [bigint, bigint, readonly `0x${string}`[], bigint];
  return {
    address,
    contribution,
    memberCount,
    members: membersRaw.map((m) => getAddress(m) as `0x${string}`),
    completed: currentCycle >= memberCount,
  };
}

async function discover(
  publicClient: PublicClient,
  factoryAddr: `0x${string}` | null,
  seedChama: `0x${string}` | null,
) {
  const addrs = new Set<`0x${string}`>();
  if (seedChama) addrs.add(seedChama);
  if (factoryAddr) {
    try {
      const list = (await publicClient.readContract({
        address: factoryAddr,
        abi: factoryAbi,
        functionName: "latestChamas",
        args: [50n],
      })) as readonly `0x${string}`[];
      for (const a of list) addrs.add(getAddress(a) as `0x${string}`);
    } catch (e: any) {
      log.warn({ err: e?.message?.split("\n")[0] }, "factory discovery failed");
    }
  }

  for (const addr of addrs) {
    if (watched.has(addr)) continue;
    try {
      const cfg = await loadConfig(publicClient, addr);
      watched.set(addr, cfg);
      log.info(
        {
          chama: addr,
          members: cfg.memberCount.toString(),
          contribution: cfg.contribution.toString(),
          completed: cfg.completed,
        },
        cfg.completed ? "discovered (already completed)" : "discovered — now operating",
      );
    } catch (e: any) {
      log.warn({ chama: addr, err: e?.message?.split("\n")[0] }, "skipping; couldn't load config");
    }
  }
}

async function tickChama(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cUSDAddr: `0x${string}`,
  cfg: ChamaConfig,
) {
  const currentCycle = (await publicClient.readContract({
    address: cfg.address,
    abi: chamaAbi,
    functionName: "currentCycle",
  })) as bigint;

  if (currentCycle >= cfg.memberCount) {
    if (!cfg.completed) {
      cfg.completed = true;
      log.info({ chama: cfg.address, cycle: currentCycle.toString() }, "chama completed");
    }
    return;
  }

  const contribFlags = await Promise.all(
    cfg.members.map((m) =>
      publicClient.readContract({
        address: cfg.address,
        abi: chamaAbi,
        functionName: "contributed",
        args: [currentCycle, m],
      }) as Promise<boolean>,
    ),
  );

  log.info(
    {
      chama: cfg.address,
      cycle: currentCycle.toString(),
      contributed: contribFlags.filter(Boolean).length,
      of: Number(cfg.memberCount),
    },
    "tick",
  );

  for (let i = 0; i < cfg.members.length; i++) {
    if (contribFlags[i]) continue;
    const m = cfg.members[i];
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
        args: [m, cfg.address],
      }),
    ])) as [bigint, bigint];

    if (bal < cfg.contribution || allowance < cfg.contribution) continue;

    log.info({ chama: cfg.address, member: m, cycle: currentCycle.toString() }, "→ contributeFor()");
    const hash = await walletClient.writeContract({
      account: walletClient.account!,
      chain: celoSepolia,
      address: cfg.address,
      abi: chamaAbi,
      functionName: "contributeFor",
      args: [m],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log.info({ chama: cfg.address, member: m, tx: shortHash(hash) }, "✓ contributeFor mined");
  }

  const updatedFlags = await Promise.all(
    cfg.members.map((m) =>
      publicClient.readContract({
        address: cfg.address,
        abi: chamaAbi,
        functionName: "contributed",
        args: [currentCycle, m],
      }) as Promise<boolean>,
    ),
  );
  const deadline = (await publicClient.readContract({
    address: cfg.address,
    abi: chamaAbi,
    functionName: "cycleDeadline",
  })) as bigint;
  const allContributed = updatedFlags.every(Boolean);
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (allContributed || now >= deadline) {
    log.info(
      {
        chama: cfg.address,
        cycle: currentCycle.toString(),
        allContributed,
        deadlinePassed: now >= deadline,
      },
      "→ executePayout()",
    );
    const hash = await walletClient.writeContract({
      account: walletClient.account!,
      chain: celoSepolia,
      address: cfg.address,
      abi: chamaAbi,
      functionName: "executePayout",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log.info({ chama: cfg.address, tx: shortHash(hash) }, "✓ executePayout mined");
  }
}

async function main() {
  const deploymentPath = path.resolve(__dirname, "../../../packages/contracts/deployments/11142220.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required (this is the agent's own key)");
  const account = privateKeyToAccount(pk);

  const seedChama = deployment.contracts.Chama
    ? (getAddress(deployment.contracts.Chama) as `0x${string}`)
    : null;
  const factoryAddr = deployment.contracts.ChamaFactory
    ? (getAddress(deployment.contracts.ChamaFactory) as `0x${string}`)
    : null;
  const cUSDAddr = getAddress(deployment.contracts.cUSD) as `0x${string}`;

  const publicClient = createPublicClient({ chain: celoSepolia, transport: rpcTransport });
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport: rpcTransport });

  log.info(
    {
      agent: account.address,
      seedChama,
      factory: factoryAddr,
      cUSD: cUSDAddr,
      tickMs: TICK_MS,
    },
    "ChamaAgent online (multi-chama)",
  );

  await discover(publicClient, factoryAddr, seedChama);

  const runTick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    tickCount++;
    try {
      if (tickCount % DISCOVER_EVERY_TICKS === 0) {
        await discover(publicClient, factoryAddr, seedChama);
      }
      const active = [...watched.values()].filter((c) => !c.completed);
      if (active.length === 0 && watched.size > 0) {
        log.info("all watched chamas completed; idle");
      }
      for (const cfg of active) {
        try {
          await tickChama(publicClient, walletClient, cUSDAddr, cfg);
        } catch (err: any) {
          log.error(
            { chama: cfg.address, err: err?.shortMessage ?? err?.message?.split("\n")[0] },
            "tick error",
          );
        }
      }
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
