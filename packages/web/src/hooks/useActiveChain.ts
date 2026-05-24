import { useChainId } from "wagmi";
import { DEFAULT_CHAIN_ID, getChainConfig, getPublicClient } from "@/lib/chain";

/**
 * Reads the wallet's currently-selected chain (or default mainnet if not
 * connected) and returns the matching contracts + ERC-8004 + Self config.
 * All chain-aware components should call this instead of importing the
 * static defaults from chain.ts.
 */
export function useActiveChain() {
  const chainId = useChainId();
  const id =
    chainId === 42220 || chainId === 11142220 ? chainId : DEFAULT_CHAIN_ID;
  const cfg = getChainConfig(id);
  return {
    ...cfg,
    publicClient: getPublicClient(id),
  };
}
