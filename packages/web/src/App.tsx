import { useEffect, useState } from "react";
import {
  AGENT_ADDR,
  CHAMA_ADDR,
  CUSD_ADDR,
  DEPLOY_MEMBERS,
  chamaAbi,
  erc20Abi,
  explorer,
  explorerTx,
  formatUnits,
  publicClient,
  shortAddr,
} from "./chain";

type StaticConfig = {
  contribution: bigint;
  cycleLength: bigint;
  startTime: bigint;
  memberCount: bigint;
  members: readonly `0x${string}`[];
};

type ChamaState = StaticConfig & {
  currentCycle: bigint;
  currentPayee: `0x${string}`;
  cycleDeadline: bigint;
  contributedFlags: boolean[];
  balances: bigint[];
  potThisCycle: bigint;
};

type ActivityEvent = {
  kind: "Contributed" | "PayoutExecuted" | "CycleAdvanced" | "Defaulted";
  member?: string;
  payee?: string;
  cycle: bigint;
  amount?: bigint;
  txHash: string;
  blockNumber: bigint;
};

async function readStatic(): Promise<StaticConfig> {
  const [contribution, cycleLength, startTime, memberCount, members] = (await Promise.all([
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "contribution" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "cycleLength" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "startTime" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "memberCount" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "members" }),
  ])) as [bigint, bigint, bigint, bigint, readonly `0x${string}`[]];
  return { contribution, cycleLength, startTime, memberCount, members };
}

async function readDynamic(cfg: StaticConfig): Promise<ChamaState> {
  const [currentCycle, currentPayee, cycleDeadline] = (await Promise.all([
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "currentCycle" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "currentPayee" }),
    publicClient.readContract({ address: CHAMA_ADDR, abi: chamaAbi, functionName: "cycleDeadline" }),
  ])) as [bigint, `0x${string}`, bigint];

  const cycle = currentCycle >= cfg.memberCount ? cfg.memberCount - 1n : currentCycle;
  const [contributedFlags, balances] = await Promise.all([
    Promise.all(
      cfg.members.map(
        (m) =>
          publicClient.readContract({
            address: CHAMA_ADDR,
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
  const filledCount = contributedFlags.filter(Boolean).length;
  const potThisCycle = filledCount > 0 ? cfg.contribution * BigInt(filledCount) : 0n;

  return {
    ...cfg,
    currentCycle,
    currentPayee,
    cycleDeadline,
    contributedFlags,
    balances,
    potThisCycle,
  };
}

// thirdweb's public RPC caps eth_getLogs at 1000 blocks per request.
const LOG_WINDOW = 999n;
const LOG_LOOKBACK_WINDOWS = 5; // ~5000 blocks ≈ 7 hours on Celo

async function readActivity(): Promise<ActivityEvent[]> {
  const latest = await publicClient.getBlockNumber();
  const eventsFilter = chamaAbi.filter((x) => x.type === "event");
  const logs: any[] = [];
  for (let i = 0; i < LOG_LOOKBACK_WINDOWS; i++) {
    const to = latest - BigInt(i) * LOG_WINDOW;
    const from = to > LOG_WINDOW ? to - LOG_WINDOW : 0n;
    if (to < from) break;
    const chunk = await publicClient.getLogs({
      address: CHAMA_ADDR,
      fromBlock: from,
      toBlock: to,
      events: eventsFilter,
    });
    logs.push(...chunk);
    if (from === 0n) break;
  }
  return logs
    .map((l): ActivityEvent | null => {
      const name = (l as any).eventName as string;
      const args = (l as any).args as any;
      if (name === "Contributed") {
        return {
          kind: "Contributed",
          member: args.member,
          cycle: args.cycle,
          amount: args.amount,
          txHash: l.transactionHash!,
          blockNumber: l.blockNumber!,
        };
      }
      if (name === "PayoutExecuted") {
        return {
          kind: "PayoutExecuted",
          payee: args.payee,
          cycle: args.cycle,
          amount: args.amount,
          txHash: l.transactionHash!,
          blockNumber: l.blockNumber!,
        };
      }
      if (name === "CycleAdvanced") {
        return { kind: "CycleAdvanced", cycle: args.newCycle, txHash: l.transactionHash!, blockNumber: l.blockNumber! };
      }
      if (name === "Defaulted") {
        return {
          kind: "Defaulted",
          member: args.member,
          cycle: args.cycle,
          txHash: l.transactionHash!,
          blockNumber: l.blockNumber!,
        };
      }
      return null;
    })
    .filter((e): e is ActivityEvent => e !== null)
    .sort((a, b) => Number(b.blockNumber - a.blockNumber))
    .slice(0, 12);
}

function memberLabel(addr: string) {
  const idx = DEPLOY_MEMBERS.findIndex((m) => m.toLowerCase() === addr.toLowerCase());
  return idx >= 0 ? `MEMBER${idx + 1}` : "?";
}

function CountDown({ deadline }: { deadline: bigint }) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const remain = Number(deadline) - now;
  if (remain <= 0) return <span className="text-amber-400">deadline elapsed — agent can payout now</span>;
  const mins = Math.floor(remain / 60);
  const secs = remain % 60;
  return (
    <span className="mono">
      {mins}:{String(secs).padStart(2, "0")} until deadline
    </span>
  );
}

export default function App() {
  const [state, setState] = useState<ChamaState | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let cfg: StaticConfig | null = null;
    const refresh = async () => {
      try {
        if (!cfg) cfg = await readStatic();
        const [s, a] = await Promise.all([readDynamic(cfg), readActivity()]);
        if (!alive) return;
        setState(s);
        setActivity(a);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e.message?.split("\n")[0] ?? String(e));
      }
    };
    refresh();
    const id = setInterval(refresh, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const completed = state ? state.currentCycle >= state.memberCount : false;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <header className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Chama<span className="text-amber-400">Agent</span>
          </h1>
          <p className="text-zinc-400 mt-2 max-w-xl">
            Trustless rotating savings (ROSCA / chama / ajo / esusu) on Celo. Members verified via Self ID, agent
            escrows cUSD, rotates the full pot to each member in fixed order.
          </p>
        </div>
        <div className="text-xs text-right space-y-1 hidden sm:block">
          <div className="text-zinc-500">Network</div>
          <div className="mono text-zinc-300">Celo Sepolia · 11142220</div>
        </div>
      </header>

      {err && (
        <div className="mb-6 px-4 py-3 rounded bg-red-950/40 border border-red-900 text-red-300 text-sm">
          RPC error: {err}
        </div>
      )}

      {!state && !err && <div className="text-zinc-500">loading on-chain state…</div>}

      {state && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Status" value={completed ? "Completed" : `Cycle ${state.currentCycle.toString()} of ${state.memberCount.toString()}`} accent={completed ? "text-emerald-400" : "text-amber-400"} />
            <Stat label="Contribution / cycle" value={`${formatUnits(state.contribution)} mcUSD`} />
            <Stat label="Pot this cycle" value={`${formatUnits(state.potThisCycle)} mcUSD`} />
            <Stat
              label="Next payee"
              value={completed ? "—" : `${memberLabel(state.currentPayee)} · ${shortAddr(state.currentPayee)}`}
            />
          </section>

          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-3">Members</h2>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/50 text-zinc-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Member</th>
                    <th className="text-left px-4 py-3 font-medium">Address</th>
                    <th className="text-right px-4 py-3 font-medium">Balance</th>
                    <th className="text-center px-4 py-3 font-medium">Contributed (current cycle)</th>
                    <th className="text-center px-4 py-3 font-medium">Is next payee</th>
                  </tr>
                </thead>
                <tbody>
                  {state.members.map((m, i) => (
                    <tr key={m} className="border-t border-zinc-800/60">
                      <td className="px-4 py-3 font-semibold">{memberLabel(m)}</td>
                      <td className="px-4 py-3 mono">
                        <a className="hover:text-amber-400" href={explorer(m)} target="_blank" rel="noreferrer">
                          {shortAddr(m)}
                        </a>
                      </td>
                      <td className="px-4 py-3 mono text-right">{formatUnits(state.balances[i])} mcUSD</td>
                      <td className="px-4 py-3 text-center">
                        {state.contributedFlags[i] ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">·</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {state.currentPayee.toLowerCase() === m.toLowerCase() && !completed ? (
                          <span className="text-amber-400">★</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!completed && (
              <p className="text-xs text-zinc-500 mt-2">
                <CountDown deadline={state.cycleDeadline} />
              </p>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-3">Recent activity</h2>
            <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800/60">
              {activity.length === 0 && <div className="px-4 py-6 text-zinc-500 text-sm">no events yet</div>}
              {activity.map((e, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between text-sm gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge kind={e.kind} />
                    <span className="text-zinc-300 truncate">
                      cycle <span className="mono">{e.cycle.toString()}</span>
                      {e.member && (
                        <>
                          {" · "}
                          {memberLabel(e.member)}
                        </>
                      )}
                      {e.payee && (
                        <>
                          {" · "}
                          {memberLabel(e.payee)} got{" "}
                          <span className="mono">{e.amount ? formatUnits(e.amount) : "?"}</span> mcUSD
                        </>
                      )}
                    </span>
                  </div>
                  <a
                    className="mono text-xs text-zinc-500 hover:text-amber-400 shrink-0"
                    href={explorerTx(e.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.txHash.slice(0, 10)}…
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section className="text-xs text-zinc-500 space-y-1 mono">
            <div>
              Chama:{" "}
              <a className="hover:text-amber-400" href={explorer(CHAMA_ADDR)} target="_blank" rel="noreferrer">
                {CHAMA_ADDR}
              </a>
            </div>
            <div>
              mcUSD:{" "}
              <a className="hover:text-amber-400" href={explorer(CUSD_ADDR)} target="_blank" rel="noreferrer">
                {CUSD_ADDR}
              </a>
            </div>
            <div>
              Agent:{" "}
              <a className="hover:text-amber-400" href={explorer(AGENT_ADDR)} target="_blank" rel="noreferrer">
                {AGENT_ADDR}
              </a>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function Badge({ kind }: { kind: ActivityEvent["kind"] }) {
  const map: Record<ActivityEvent["kind"], string> = {
    Contributed: "bg-sky-950/40 border-sky-900/60 text-sky-300",
    PayoutExecuted: "bg-emerald-950/40 border-emerald-900/60 text-emerald-300",
    CycleAdvanced: "bg-zinc-900 border-zinc-800 text-zinc-400",
    Defaulted: "bg-red-950/40 border-red-900/60 text-red-300",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${map[kind]} shrink-0`}>
      {kind}
    </span>
  );
}
