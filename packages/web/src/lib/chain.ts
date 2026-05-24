import { createPublicClient, defineChain, fallback, http, parseAbi } from "viem";
import deployment from "../../../contracts/deployments/11142220.json";

export const RPC_URLS = [
  "https://forno.celo-sepolia.celo-testnet.org",
  "https://celo-sepolia.drpc.org",
  "https://11142220.rpc.thirdweb.com",
];

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: fallback(
    RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
    { rank: false },
  ),
});

export const CHAMA_ADDR = deployment.contracts.Chama as `0x${string}`;
export const CUSD_ADDR = deployment.contracts.cUSD as `0x${string}`;
export const CHAMA_FACTORY_ADDR =
  ((deployment as any).contracts?.ChamaFactory as `0x${string}` | undefined) ?? null;
export const AGENT_ADDR = deployment.agent as `0x${string}`;
export const DEPLOY_MEMBERS = deployment.members as `0x${string}`[];
export const ERC8004_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`;
/** Reputation Registry on Celo Sepolia (members attest to the agent's performance). */
export const ERC8004_REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`;
export const ERC8004_AGENT_ID = (deployment as any).erc8004?.agentId
  ? BigInt((deployment as any).erc8004.agentId)
  : 274n;

export const chamaAbi = parseAbi([
  "function contribution() view returns (uint256)",
  "function cycleLength() view returns (uint256)",
  "function openTimeout() view returns (uint256)",
  "function rounds() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function currentCycle() view returns (uint256)",
  "function currentCycleOpenAt() view returns (uint256)",
  "function currentCycleActiveAt() view returns (uint256)",
  "function memberCount() view returns (uint256)",
  "function totalCycles() view returns (uint256)",
  "function currentRound() view returns (uint256)",
  "function members() view returns (address[])",
  "function currentPayee() view returns (address)",
  "function cycleDeadline() view returns (uint256)",
  "function isCycleActive() view returns (bool)",
  "function contributed(uint256 cycle, address member) view returns (bool)",
  "function contributeFor(address member)",
  "function executePayout()",
  "event Contributed(address indexed member, uint256 indexed cycle, uint256 amount)",
  "event CycleActivated(uint256 indexed cycle, uint256 timestamp)",
  "event Defaulted(address indexed member, uint256 indexed cycle)",
  "event PayoutExecuted(address indexed payee, uint256 indexed cycle, uint256 amount)",
  "event CycleAdvanced(uint256 indexed newCycle)",
  "event ChamaCompleted()",
]);

const erc20Signatures = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

export const erc20Abi = parseAbi(erc20Signatures);

export const mockCUSDAbi = parseAbi([
  ...erc20Signatures,
  "function mint(address to, uint256 amount)",
]);

export const reputationRegistryAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
  "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 indexed index, int128 value, uint8 valueDecimals, string tag1, string tag2)",
]);

export const chamaFactoryAbi = parseAbi([
  "function token() view returns (address)",
  "function agent() view returns (address)",
  "function chamasCount() view returns (uint256)",
  "function chamaAt(uint256 index) view returns (address)",
  "function latestChamas(uint256 limit) view returns (address[])",
  "function chamasOf(address creator) view returns (address[])",
  "function createdAt(address chama) view returns (uint256)",
  "function createChama(address[] members, uint256 contribution, uint256 cycleLength, uint256 openTimeout, uint256 rounds) returns (address)",
  "event ChamaCreated(address indexed creator, address indexed chama, address[] members, uint256 contribution, uint256 cycleLength, uint256 openTimeout, uint256 rounds, uint256 index)",
]);
