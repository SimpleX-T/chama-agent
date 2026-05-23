import { useEffect, useState } from "react";
import { CHAMA_ADDR, CUSD_ADDR, chamaAbi, erc20Abi, publicClient } from "@/lib/chain";

export type StaticConfig = {
  contribution: bigint;
  cycleLength: bigint;
  startTime: bigint;
  memberCount: bigint;
  members: readonly `0x${string}`[];
};

export type ChamaState = StaticConfig & {
  currentCycle: bigint;
  currentPayee: `0x${string}`;
  cycleDeadline: bigint;
  contributedFlags: boolean[];
  balances: bigint[];
  potThisCycle: bigint;
  completed: boolean;
};

async function readStatic(addr: `0x${string}`): Promise<StaticConfig> {
  const [contribution, cycleLength, startTime, memberCount, members] = (await Promise.all([
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "contribution" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "cycleLength" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "startTime" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "memberCount" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "members" }),
  ])) as [bigint, bigint, bigint, bigint, readonly `0x${string}`[]];
  return { contribution, cycleLength, startTime, memberCount, members };
}

async function readDynamic(addr: `0x${string}`, cfg: StaticConfig): Promise<ChamaState> {
  const [currentCycle, currentPayee, cycleDeadline] = (await Promise.all([
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "currentCycle" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "currentPayee" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "cycleDeadline" }),
  ])) as [bigint, `0x${string}`, bigint];

  const completed = currentCycle >= cfg.memberCount;
  const cycle = completed ? cfg.memberCount - 1n : currentCycle;

  const [contributedFlags, balances] = await Promise.all([
    Promise.all(
      cfg.members.map(
        (m) =>
          publicClient.readContract({
            address: addr,
            abi: chamaAbi,
            functionName: "contributed",
            args: [cycle, m],
          }) as Promise<boolean>,
      ),
    ),
    Promise.all(
      cfg.members.map(
        (m) =>
          publicClient.readContract({
            address: CUSD_ADDR,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [m],
          }) as Promise<bigint>,
      ),
    ),
  ]);
  const filled = contributedFlags.filter(Boolean).length;
  const potThisCycle = filled > 0 ? cfg.contribution * BigInt(filled) : 0n;
  return { ...cfg, currentCycle, currentPayee, cycleDeadline, contributedFlags, balances, potThisCycle, completed };
}

export function useChamaState(address: `0x${string}` = CHAMA_ADDR, intervalMs = 12_000) {
  const [data, setData] = useState<ChamaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let cfg: StaticConfig | null = null;
    const tick = async () => {
      try {
        if (!cfg) cfg = await readStatic(address);
        const s = await readDynamic(address, cfg);
        if (!alive) return;
        setData(s);
        setError(null);
        setIsLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.shortMessage ?? e?.message?.split("\n")[0] ?? String(e));
        setIsLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address, intervalMs]);

  return { data, error, isLoading };
}
