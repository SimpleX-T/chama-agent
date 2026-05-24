import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  defineChain,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// CHAIN={sepolia|mainnet} selects which network to register on.
// Defaults to sepolia for safety; pass CHAIN=mainnet for the mainnet
// registration.
const TARGET = (process.env.CHAIN ?? "sepolia").toLowerCase();
const IS_MAINNET = TARGET === "mainnet" || TARGET === "celo" || TARGET === "42220";

const CONFIG = IS_MAINNET
  ? {
      chainName: "celo",
      chainSlug: "celo",
      chainId: 42220,
      registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`,
      rpc:
        process.env.CELO_RPC?.split(",")[0]?.trim() ?? "https://forno.celo.org",
      explorer: "https://celoscan.io",
      currency: { name: "CELO", symbol: "CELO", decimals: 18 },
      pkEnvVar: "MAINNET_DEPLOYER_PRIVATE_KEY",
      deploymentFile: "42220.json",
    }
  : {
      chainName: "Celo Sepolia",
      chainSlug: "celo-sepolia",
      chainId: 11142220,
      registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,
      rpc:
        process.env.CELO_SEPOLIA_RPC?.split(",")[0]?.trim() ?? "https://11142220.rpc.thirdweb.com",
      explorer: "https://celo-sepolia.blockscout.com",
      currency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
      pkEnvVar: "DEPLOYER_PRIVATE_KEY",
      deploymentFile: "11142220.json",
    };

const chain = defineChain({
  id: CONFIG.chainId,
  name: CONFIG.chainName,
  nativeCurrency: CONFIG.currency,
  rpcUrls: { default: { http: [CONFIG.rpc] } },
  blockExplorers: { default: { name: "Explorer", url: CONFIG.explorer } },
});

const abi = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

async function main() {
  const agentURI = process.env.AGENT_CARD_URI;
  const pk = process.env[CONFIG.pkEnvVar] as `0x${string}` | undefined;
  if (!agentURI) throw new Error("AGENT_CARD_URI required (e.g. raw GitHub URL to agent-card.json)");
  if (!pk) throw new Error(`${CONFIG.pkEnvVar} required for ${CONFIG.chainName}`);

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({ account, chain, transport: http() });

  console.log(`Registering agent on ${CONFIG.chainName} ERC-8004 (${CONFIG.registry})`);
  console.log(`  agentURI: ${agentURI}`);
  console.log(`  owner:    ${account.address}`);

  const hash = await walletClient.writeContract({
    address: CONFIG.registry,
    abi,
    functionName: "register",
    args: [agentURI],
  });
  console.log(`  tx:       ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let agentId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONFIG.registry.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "Registered") {
        agentId = decoded.args.agentId as bigint;
        break;
      }
    } catch {
      /* not our event */
    }
  }
  if (!agentId) throw new Error("Could not find Registered event in receipt");

  console.log(`  agentId:  ${agentId}`);
  console.log(`  8004scan: https://8004scan.io/agents/${CONFIG.chainSlug}/${agentId}`);

  const out = path.resolve(__dirname, "..", "deployments", CONFIG.deploymentFile);
  const deployment = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf-8")) : {};
  deployment.erc8004 = {
    registry: CONFIG.registry,
    agentId: agentId.toString(),
    agentURI,
    txHash: hash,
  };
  fs.writeFileSync(out, JSON.stringify(deployment, null, 2));
  console.log(`  saved -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
