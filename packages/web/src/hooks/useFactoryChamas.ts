import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";
import { chamaFactoryAbi } from "@/lib/chain";
import { useActiveChain } from "@/hooks/useActiveChain";

export type FactoryChama = {
  address: `0x${string}`;
  createdAt: bigint;
};

export function useFactoryChamas(limit = 24) {
  const { publicClient, chainId, contracts } = useActiveChain();
  const factoryAddr = contracts.ChamaFactory;
  const [data, setData] = useState<FactoryChama[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    if (!factoryAddr) {
      setData([]);
      setIsLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const addrs = (await publicClient.readContract({
          address: factoryAddr,
          abi: chamaFactoryAbi,
          functionName: "latestChamas",
          args: [BigInt(limit)],
        })) as readonly `0x${string}`[];

        const withTimes = await Promise.all(
          addrs.map(async (addr) => {
            const t = (await publicClient.readContract({
              address: factoryAddr,
              abi: chamaFactoryAbi,
              functionName: "createdAt",
              args: [addr],
            })) as bigint;
            return { address: addr, createdAt: t };
          }),
        );

        if (!alive) return;
        setData(withTimes);
        setError(null);
        setIsLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.shortMessage ?? e?.message?.split("\n")[0] ?? String(e));
        setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [factoryAddr, limit, blockNumber, chainId, publicClient]);

  return { data, isLoading, error };
}
