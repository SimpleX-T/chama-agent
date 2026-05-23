import { createPublicClient, defineChain, fallback, http, parseAbi } from "viem";
import deployment from "../../contracts/deployments/11142220.json";

const RPC_URLS = [
  "https://forno.celo-sepolia.celo-testnet.org",
  "https://celo-sepolia.drpc.org",
  "https://11142220.rpc.thirdweb.com",
];

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
  rpcUrls: {
    default: { http: RPC_URLS },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
});

export const publicClient = createPublicClient({
  chain: celoSepolia,
  // Fallback across multiple public RPCs — any one of them can throttle or drop us
  // and viem will transparently try the next.
  transport: fallback(
    RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
    { rank: false },
  ),
});

export const CHAMA_ADDR = deployment.contracts.Chama as `0x${string}`;
export const CUSD_ADDR = deployment.contracts.cUSD as `0x${string}`;
export const AGENT_ADDR = deployment.agent as `0x${string}`;
export const DEPLOY_MEMBERS = deployment.members as `0x${string}`[];

export const chamaAbi = parseAbi([
  "function contribution() view returns (uint256)",
  "function cycleLength() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function currentCycle() view returns (uint256)",
  "function memberCount() view returns (uint256)",
  "function members() view returns (address[])",
  "function currentPayee() view returns (address)",
  "function cycleDeadline() view returns (uint256)",
  "function contributed(uint256 cycle, address member) view returns (bool)",
  "event Contributed(address indexed member, uint256 indexed cycle, uint256 amount)",
  "event PayoutExecuted(address indexed payee, uint256 indexed cycle, uint256 amount)",
  "event CycleAdvanced(uint256 indexed newCycle)",
  "event Defaulted(address indexed member, uint256 indexed cycle)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

export const explorer = (addr: string) => `${celoSepolia.blockExplorers.default.url}/address/${addr}`;
export const explorerTx = (hash: string) => `${celoSepolia.blockExplorers.default.url}/tx/${hash}`;
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const formatUnits = (v: bigint, decimals = 18, dp = 2) => {
  const d = 10n ** BigInt(decimals);
  const whole = v / d;
  const frac = v % d;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
};
