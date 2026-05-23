import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";
import { CHAMA_FACTORY_ADDR, chamaFactoryAbi, publicClient } from "@/lib/chain";

export type FactoryChama = {
  address: `0x${string}`;
  createdAt: bigint;
};

export function useFactoryChamas(limit = 24) {
  const [data, setData] = useState<FactoryChama[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    if (!CHAMA_FACTORY_ADDR) {
      setIsLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const addrs = (await publicClient.readContract({
          address: CHAMA_FACTORY_ADDR,
          abi: chamaFactoryAbi,
          functionName: "latestChamas",
          args: [BigInt(limit)],
        })) as readonly `0x${string}`[];

        const withTimes = await Promise.all(
          addrs.map(async (addr) => {
            const t = (await publicClient.readContract({
              address: CHAMA_FACTORY_ADDR,
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
  }, [limit, blockNumber]);

  return { data, isLoading, error };
}
