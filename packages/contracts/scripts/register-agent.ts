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

const REGISTRIES = {
  11142220: "0x8004A818BFB912233c491871b3d84c89A494BD9e", // Celo Sepolia
  42220: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", // Celo mainnet
} as const;

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

const abi = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

async function main() {
  const agentURI = process.env.AGENT_CARD_URI;
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!agentURI) throw new Error("AGENT_CARD_URI required (e.g. raw GitHub URL to agent-card.json)");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required");

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: celoSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http() });
  const registry = REGISTRIES[11142220];

  console.log(`Registering agent on ERC-8004 (${registry})`);
  console.log(`  agentURI: ${agentURI}`);
  console.log(`  owner:    ${account.address}`);

  const hash = await walletClient.writeContract({
    address: registry,
    abi,
    functionName: "register",
    args: [agentURI],
  });
  console.log(`  tx:       ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let agentId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "Registered") {
        agentId = decoded.args.agentId as bigint;
        break;
      }
    } catch {
      // not the event we want
    }
  }
  if (!agentId) throw new Error("Could not find Registered event in receipt");

  console.log(`  agentId:  ${agentId}`);
  console.log(`  8004scan: https://8004scan.io/agents/celo-sepolia/${agentId}`);

  const out = path.resolve(__dirname, "..", "deployments", "11142220.json");
  const deployment = JSON.parse(fs.readFileSync(out, "utf-8"));
  deployment.erc8004 = {
    registry,
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
