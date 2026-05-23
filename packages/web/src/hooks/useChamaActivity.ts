import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";
import { chamaAbi, publicClient } from "@/lib/chain";

export type ActivityKind = "Contributed" | "PayoutExecuted" | "CycleAdvanced" | "Defaulted" | "ChamaCompleted";

export type ActivityEvent = {
  kind: ActivityKind;
  member?: string;
  payee?: string;
  cycle: bigint;
  amount?: bigint;
  txHash: string;
  blockNumber: bigint;
};

// thirdweb's public RPC caps eth_getLogs at 1000 blocks per request
const WINDOW = 999n;
const WINDOWS = 5;

async function readActivity(address: `0x${string}`): Promise<ActivityEvent[]> {
  const latest = await publicClient.getBlockNumber();
  const eventsFilter = chamaAbi.filter((x) => x.type === "event");
  const logs: any[] = [];
  for (let i = 0; i < WINDOWS; i++) {
    const to = latest - BigInt(i) * WINDOW;
    const from = to > WINDOW ? to - WINDOW : 0n;
    if (to < from) break;
    const chunk = await publicClient.getLogs({
      address,
      fromBlock: from,
      toBlock: to,
      events: eventsFilter,
    });
    logs.push(...chunk);
    if (from === 0n) break;
  }
  return logs
    .map((l): ActivityEvent | null => {
      const name = l.eventName as ActivityKind;
      const args = l.args ?? {};
      switch (name) {
        case "Contributed":
          return {
            kind: name,
            member: args.member,
            cycle: args.cycle,
            amount: args.amount,
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
          };
        case "PayoutExecuted":
          return {
            kind: name,
            payee: args.payee,
            cycle: args.cycle,
            amount: args.amount,
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
          };
        case "CycleAdvanced":
          return { kind: name, cycle: args.newCycle, txHash: l.transactionHash, blockNumber: l.blockNumber };
        case "Defaulted":
          return {
            kind: name,
            member: args.member,
            cycle: args.cycle,
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
          };
        case "ChamaCompleted":
          return { kind: name, cycle: 0n, txHash: l.transactionHash, blockNumber: l.blockNumber };
        default:
          return null;
      }
    })
    .filter((e): e is ActivityEvent => e !== null)
    .sort((a, b) => Number(b.blockNumber - a.blockNumber))
    .slice(0, 24);
}

export function useChamaActivity(address: `0x${string}`) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const e = await readActivity(address);
        if (!alive) return;
        setEvents(e);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.shortMessage ?? e?.message?.split("\n")[0] ?? String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, blockNumber]);

  return { events, error };
}
