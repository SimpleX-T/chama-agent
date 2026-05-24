import { createPublicClient, defineChain, fallback, http, parseAbi } from "viem";
import sepoliaDeployment from "../../../contracts/deployments/11142220.json";
import mainnetDeployment from "../../../contracts/deployments/42220.json";

// -----------------------------------------------------------------------------
// Chain configs
// -----------------------------------------------------------------------------

export const SEPOLIA_RPC_URLS = [
  "https://forno.celo-sepolia.celo-testnet.org",
  "https://celo-sepolia.drpc.org",
  "https://11142220.rpc.thirdweb.com",
];

export const MAINNET_RPC_URLS = [
  "https://forno.celo.org",
  "https://rpc.ankr.com/celo",
];

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO-S", symbol: "CELO-S", decimals: 18 },
  rpcUrls: { default: { http: SEPOLIA_RPC_URLS } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
});

export const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: MAINNET_RPC_URLS } },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celoscan.io" },
  },
});

// -----------------------------------------------------------------------------
// Per-chain deployment registry
// -----------------------------------------------------------------------------

export type SupportedChainId = 42220 | 11142220;

export const DEFAULT_CHAIN_ID: SupportedChainId = 42220;

type ChainConfig = {
  chainId: SupportedChainId;
  chainName: string;
  shortName: string;
  isTestnet: boolean;
  explorer: string;
  rpcUrls: string[];
  contracts: {
    Chama: `0x${string}` | null;
    ChamaFactory: `0x${string}` | null;
    ChamaVerifier: `0x${string}` | null;
    cUSD: `0x${string}`;
  };
  deployMembers: `0x${string}`[];
  agentAddress: `0x${string}` | null;
  erc8004: {
    identityRegistry: `0x${string}`;
    reputationRegistry: `0x${string}`;
    agentId: bigint | null;
    /** Slug used in 8004scan.io URLs */
    scanSlug: string;
  };
  self: {
    hub: `0x${string}`;
    /** "celo" for prod proofs, "staging_celo" for mock-passport dev */
    endpointType: "celo" | "staging_celo";
  };
  cUSDSymbol: string;
};

const asAddr = (x: unknown): `0x${string}` | null =>
  typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x) ? (x as `0x${string}`) : null;

const CHAIN_REGISTRY: Record<SupportedChainId, ChainConfig> = {
  42220: {
    chainId: 42220,
    chainName: "Celo",
    shortName: "Mainnet",
    isTestnet: false,
    explorer: "https://celoscan.io",
    rpcUrls: MAINNET_RPC_URLS,
    contracts: {
      Chama: asAddr((mainnetDeployment as any).contracts?.Chama),
      ChamaFactory: asAddr((mainnetDeployment as any).contracts?.ChamaFactory),
      ChamaVerifier: asAddr((mainnetDeployment as any).contracts?.ChamaVerifier),
      cUSD: ((mainnetDeployment as any).contracts?.cUSD as `0x${string}`) ??
        ("0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`),
    },
    deployMembers: ((mainnetDeployment as any).members ?? []) as `0x${string}`[],
    agentAddress: asAddr((mainnetDeployment as any).agent),
    erc8004: {
      identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`,
      reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as `0x${string}`,
      agentId: (mainnetDeployment as any).erc8004?.agentId
        ? BigInt((mainnetDeployment as any).erc8004.agentId)
        : null,
      scanSlug: "celo",
    },
    self: {
      hub: "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF" as `0x${string}`,
      endpointType: "celo",
    },
    cUSDSymbol: "cUSD",
  },
  11142220: {
    chainId: 11142220,
    chainName: "Celo Sepolia",
    shortName: "Sepolia",
    isTestnet: true,
    explorer: "https://celo-sepolia.blockscout.com",
    rpcUrls: SEPOLIA_RPC_URLS,
    contracts: {
      Chama: asAddr((sepoliaDeployment as any).contracts?.Chama),
      ChamaFactory: asAddr((sepoliaDeployment as any).contracts?.ChamaFactory),
      ChamaVerifier: asAddr((sepoliaDeployment as any).contracts?.ChamaVerifier),
      cUSD: ((sepoliaDeployment as any).contracts?.cUSD as `0x${string}`) ??
        ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    },
    deployMembers: ((sepoliaDeployment as any).members ?? []) as `0x${string}`[],
    agentAddress: asAddr((sepoliaDeployment as any).agent),
    erc8004: {
      identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,
      reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,
      agentId: (sepoliaDeployment as any).erc8004?.agentId
        ? BigInt((sepoliaDeployment as any).erc8004.agentId)
        : 274n,
      scanSlug: "celo-sepolia",
    },
    self: {
      hub: "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74" as `0x${string}`,
      endpointType: "staging_celo",
    },
    cUSDSymbol: "mcUSD",
  },
};

export function getChainConfig(chainId: number): ChainConfig {
  return CHAIN_REGISTRY[chainId as SupportedChainId] ?? CHAIN_REGISTRY[DEFAULT_CHAIN_ID];
}

export const SUPPORTED_CHAINS = [celoMainnet, celoSepolia] as const;

// -----------------------------------------------------------------------------
// Public client cache (one per chain)
// -----------------------------------------------------------------------------

const publicClients = new Map<SupportedChainId, ReturnType<typeof createPublicClient>>();
export function getPublicClient(chainId: number) {
  const id = (chainId === 42220 ? 42220 : 11142220) as SupportedChainId;
  if (!publicClients.has(id)) {
    const cfg = CHAIN_REGISTRY[id];
    const chain = id === 42220 ? celoMainnet : celoSepolia;
    publicClients.set(
      id,
      createPublicClient({
        chain,
        transport: fallback(
          cfg.rpcUrls.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
          { rank: false },
        ),
      }),
    );
  }
  return publicClients.get(id)!;
}

// Default (mainnet) — kept for components that haven't been threaded with
// useActiveChain yet. New code should call getChainConfig(chainId) instead.
export const publicClient = getPublicClient(DEFAULT_CHAIN_ID);
const defaultCfg = CHAIN_REGISTRY[DEFAULT_CHAIN_ID];
export const CHAMA_ADDR = defaultCfg.contracts.Chama ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`);
export const CUSD_ADDR = defaultCfg.contracts.cUSD;
export const CHAMA_FACTORY_ADDR = defaultCfg.contracts.ChamaFactory;
export const AGENT_ADDR = defaultCfg.agentAddress ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`);
export const DEPLOY_MEMBERS = defaultCfg.deployMembers;
export const ERC8004_REGISTRY = defaultCfg.erc8004.identityRegistry;
export const ERC8004_REPUTATION = defaultCfg.erc8004.reputationRegistry;
export const ERC8004_AGENT_ID = defaultCfg.erc8004.agentId ?? 9146n;

// -----------------------------------------------------------------------------
// ABIs
// -----------------------------------------------------------------------------

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
