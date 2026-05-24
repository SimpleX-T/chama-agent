// Default to mainnet (Celoscan); switch via the chain-aware variants below
// when the wallet's connected to Sepolia.
export const explorer = (addr: string) =>
  `https://celoscan.io/address/${addr}`;
export const explorerTx = (hash: string) =>
  `https://celoscan.io/tx/${hash}`;

const EXPLORERS: Record<number, string> = {
  42220: "https://celoscan.io",
  11142220: "https://celo-sepolia.blockscout.com",
};

export const explorerForChain = (chainId: number, addr: string) =>
  `${EXPLORERS[chainId] ?? EXPLORERS[42220]}/address/${addr}`;
export const explorerTxForChain = (chainId: number, hash: string) =>
  `${EXPLORERS[chainId] ?? EXPLORERS[42220]}/tx/${hash}`;

export function shortAddr(a: string, head = 6, tail = 4) {
  if (!a) return "";
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function formatUnits(v: bigint, decimals = 18, dp = 2): string {
  if (v === 0n) return "0";
  const d = 10n ** BigInt(decimals);
  const whole = v / d;
  const frac = v % d;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export function secondsToHMS(total: number) {
  if (total <= 0) return { h: 0, m: 0, s: 0, expired: true };
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s, expired: false };
}

export function relativeTime(secondsAgo: number) {
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}
