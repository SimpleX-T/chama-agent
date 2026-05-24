import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlockNumber } from "wagmi";
import { chamaAbi, erc20Abi } from "@/lib/chain";
import { useActiveChain } from "@/hooks/useActiveChain";

export type StaticConfig = {
  contribution: bigint;
  cycleLength: bigint;
  startTime: bigint;
  memberCount: bigint;
  rounds: bigint;
  totalCycles: bigint;
  members: readonly `0x${string}`[];
};

export type ChamaState = StaticConfig & {
  currentCycle: bigint;
  currentRound: bigint;
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

async function readStaticOnce(
  client: ReturnType<typeof useActiveChain>["publicClient"],
  addr: `0x${string}`,
): Promise<StaticConfig> {
  const [contribution, cycleLength, startTime, memberCount, members] = (await Promise.all([
    client.readContract({ address: addr, abi: chamaAbi, functionName: "contribution" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "cycleLength" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "startTime" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "memberCount" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "members" }),
  ])) as [bigint, bigint, bigint, bigint, readonly `0x${string}`[]];

  // rounds/totalCycles were added in v7. Older chamas (single-rotation) lack
  // these; default to rounds=1 / totalCycles=memberCount.
  let rounds = 1n;
  let totalCycles = memberCount;
  try {
    rounds = (await client.readContract({
      address: addr,
      abi: chamaAbi,
      functionName: "rounds",
    })) as bigint;
    totalCycles = memberCount * rounds;
  } catch {
    /* legacy chama — rounds defaults to 1 */
  }
  return { contribution, cycleLength, startTime, memberCount, rounds, totalCycles, members };
}

/**
 * Static-config reader with retry. After a chama is freshly deployed via the
 * factory, a load-balanced RPC node we hit a moment later may not yet have the
 * new bytecode; viem then returns "0x" / "returned no data". We retry with a
 * gentle backoff (0.5s, 1s, 2s, 4s, 8s — total ~15s) before propagating the error.
 */
async function readStatic(
  client: ReturnType<typeof useActiveChain>["publicClient"],
  addr: `0x${string}`,
): Promise<StaticConfig> {
  const backoff = [500, 1000, 2000, 4000, 8000];
  let lastErr: unknown;
  for (let i = 0; i <= backoff.length; i++) {
    try {
      return await readStaticOnce(client, addr);
    } catch (e) {
      lastErr = e;
      if (i === backoff.length || !isPropagationGlitch(e)) break;
      await new Promise((r) => setTimeout(r, backoff[i]));
    }
  }
  throw lastErr;
}

async function readDynamic(
  client: ReturnType<typeof useActiveChain>["publicClient"],
  cUSDAddr: `0x${string}`,
  addr: `0x${string}`,
  cfg: StaticConfig,
): Promise<ChamaState> {
  const [currentCycle, currentPayee, cycleDeadline] = (await Promise.all([
    client.readContract({ address: addr, abi: chamaAbi, functionName: "currentCycle" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "currentPayee" }),
    client.readContract({ address: addr, abi: chamaAbi, functionName: "cycleDeadline" }),
  ])) as [bigint, `0x${string}`, bigint];

  // isCycleActive was added in the v6 bytecode. Older chamas don't expose it;
  // fall back to inferring from the deadline (>0 == something is ticking).
  let isActive: boolean;
  try {
    isActive = (await client.readContract({
      address: addr,
      abi: chamaAbi,
      functionName: "isCycleActive",
    })) as boolean;
  } catch {
    isActive = cycleDeadline > 0n;
  }

  const completed = currentCycle >= cfg.totalCycles;
  const cycle = completed ? cfg.totalCycles - 1n : currentCycle;
  const currentRound = cfg.memberCount > 0n ? currentCycle / cfg.memberCount : 0n;

  const [contributedFlags, balances] = await Promise.all([
    Promise.all(
      cfg.members.map(
        (m) =>
          client.readContract({
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
          client.readContract({
            address: cUSDAddr,
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
    currentRound,
    currentPayee,
    cycleDeadline,
    isActive,
    contributedFlags,
    balances,
    potThisCycle,
    completed,
  };
}

export function useChamaState(address?: `0x${string}`) {
  const activeChain = useActiveChain();
  const watchedAddress = useMemo(
    () => address ?? activeChain.contracts.Chama ?? null,
    [address, activeChain.contracts.Chama],
  );
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

  // Reset cached static config when the watched address (or chain) changes
  useEffect(() => {
    cfgRef.current = null;
    setData(null);
    setError(null);
    setIsLoading(true);
    setWaitingForDeployment(false);
  }, [watchedAddress, activeChain.chainId]);

  const tick = useCallback(async () => {
    if (!watchedAddress) {
      setError("No Chama address available on this network yet.");
      setIsLoading(false);
      setWaitingForDeployment(false);
      return;
    }
    const myToken = ++refreshTokenRef.current;
    try {
      if (!cfgRef.current) {
        setWaitingForDeployment(true);
        cfgRef.current = await readStatic(activeChain.publicClient, watchedAddress);
        if (refreshTokenRef.current !== myToken && !aliveRef.current) return;
        setWaitingForDeployment(false);
      }
      const s = await readDynamic(
        activeChain.publicClient,
        activeChain.contracts.cUSD,
        watchedAddress,
        cfgRef.current,
      );
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
  }, [watchedAddress, activeChain.chainId, activeChain.publicClient, activeChain.contracts.cUSD]);

  useEffect(() => {
    aliveRef.current = true;
    void tick();
    return () => {
      aliveRef.current = false;
    };
  }, [tick, blockNumber]);

  return { data, error, isLoading, waitingForDeployment, refresh: tick };
}
