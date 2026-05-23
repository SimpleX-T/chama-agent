import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockNumber } from "wagmi";
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
  cycleDeadline: bigint; // 0 if cycle is in OPEN phase (no countdown yet)
  isActive: boolean; // true once last contribution flips the cycle to ACTIVE
  contributedFlags: boolean[];
  balances: bigint[];
  potThisCycle: bigint;
  completed: boolean;
};

function isPropagationGlitch(err: unknown): boolean {
  const msg = String((err as any)?.shortMessage ?? (err as any)?.message ?? err ?? "");
  return (
    msg.includes('returned no data ("0x")') ||
    msg.includes("contract was not deployed") ||
    msg.includes("invalid opcode") ||
    msg.includes("could not be decoded") ||
    msg.includes("execution reverted")
  );
}

async function readStaticOnce(addr: `0x${string}`): Promise<StaticConfig> {
  const [contribution, cycleLength, startTime, memberCount, members] = (await Promise.all([
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "contribution" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "cycleLength" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "startTime" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "memberCount" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "members" }),
  ])) as [bigint, bigint, bigint, bigint, readonly `0x${string}`[]];
  return { contribution, cycleLength, startTime, memberCount, members };
}

/**
 * Static-config reader with retry. After a chama is freshly deployed via the
 * factory, a load-balanced RPC node we hit a moment later may not yet have the
 * new bytecode; viem then returns "0x" / "returned no data". We retry with a
 * gentle backoff (0.5s, 1s, 2s, 4s, 8s — total ~15s) before propagating the error.
 */
async function readStatic(addr: `0x${string}`): Promise<StaticConfig> {
  const backoff = [500, 1000, 2000, 4000, 8000];
  let lastErr: unknown;
  for (let i = 0; i <= backoff.length; i++) {
    try {
      return await readStaticOnce(addr);
    } catch (e) {
      lastErr = e;
      if (i === backoff.length || !isPropagationGlitch(e)) break;
      await new Promise((r) => setTimeout(r, backoff[i]));
    }
  }
  throw lastErr;
}

async function readDynamic(addr: `0x${string}`, cfg: StaticConfig): Promise<ChamaState> {
  const [currentCycle, currentPayee, cycleDeadline] = (await Promise.all([
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "currentCycle" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "currentPayee" }),
    publicClient.readContract({ address: addr, abi: chamaAbi, functionName: "cycleDeadline" }),
  ])) as [bigint, `0x${string}`, bigint];

  // isCycleActive was added in the v6 bytecode. Older chamas don't expose it;
  // fall back to inferring from the deadline (>0 == something is ticking).
  let isActive: boolean;
  try {
    isActive = (await publicClient.readContract({
      address: addr,
      abi: chamaAbi,
      functionName: "isCycleActive",
    })) as boolean;
  } catch {
    isActive = cycleDeadline > 0n;
  }

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
  return {
    ...cfg,
    currentCycle,
    currentPayee,
    cycleDeadline,
    isActive,
    contributedFlags,
    balances,
    potThisCycle,
    completed,
  };
}

export function useChamaState(address: `0x${string}` = CHAMA_ADDR) {
  const [data, setData] = useState<ChamaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** True while we're still waiting for the contract to show up at this RPC */
  const [waitingForDeployment, setWaitingForDeployment] = useState(false);
  const cfgRef = useRef<StaticConfig | null>(null);
  const aliveRef = useRef(true);
  const refreshTokenRef = useRef(0);

  // Drive refreshes off chain head — every new block (~5s on Celo).
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Reset cached static config when the watched address changes
  useEffect(() => {
    cfgRef.current = null;
    setData(null);
    setError(null);
    setIsLoading(true);
    setWaitingForDeployment(false);
  }, [address]);

  const tick = useCallback(async () => {
    const myToken = ++refreshTokenRef.current;
    try {
      if (!cfgRef.current) {
        setWaitingForDeployment(true);
        cfgRef.current = await readStatic(address);
        if (refreshTokenRef.current !== myToken && !aliveRef.current) return;
        setWaitingForDeployment(false);
      }
      const s = await readDynamic(address, cfgRef.current);
      if (!aliveRef.current) return;
      setData(s);
      setError(null);
      setIsLoading(false);
    } catch (e: any) {
      if (!aliveRef.current) return;
      setError(e?.shortMessage ?? e?.message?.split("\n")[0] ?? String(e));
      setIsLoading(false);
      setWaitingForDeployment(false);
    }
  }, [address]);

  useEffect(() => {
    aliveRef.current = true;
    void tick();
    return () => {
      aliveRef.current = false;
    };
  }, [tick, blockNumber]);

  return { data, error, isLoading, waitingForDeployment, refresh: tick };
}
