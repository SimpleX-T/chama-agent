import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarClock, Loader2, Plus, Sailboat, ShieldAlert, Sparkles, Sun, UserPlus, X, Zap } from "lucide-react";
import { decodeEventLog, isAddress, parseUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { chamaFactoryAbi } from "@/lib/chain";
import { useActiveChain } from "@/hooks/useActiveChain";
import { cn } from "@/lib/cn";
import { shortAddr } from "@/lib/format";

type Preset = { label: string; seconds: number };
const cycleLengthPresets: Preset[] = [
  { label: "5 minutes (demo)", seconds: 5 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "1 week", seconds: 7 * 24 * 60 * 60 },
];
const openTimeoutPresets: Preset[] = [
  { label: "2 min (demo)", seconds: 2 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { label: "Never", seconds: 0 },
];

const roundPresets = [1, 2, 3, 5, 10];

type Template = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  cycleSeconds: number;
  openTimeoutSeconds: number;
  rounds: number;
  contribution: string;
  memberCount: number; // how many empty rows to start with
};

const templates: Template[] = [
  {
    id: "demo",
    label: "Demo (live recording)",
    hint: "5-min active phase · 2-min force-advance · 3 members · 1 round — fits inside a 90-second demo video.",
    icon: Zap,
    cycleSeconds: 5 * 60,
    openTimeoutSeconds: 2 * 60,
    rounds: 1,
    contribution: "1",
    memberCount: 3,
  },
  {
    id: "merry-go-round",
    label: "Daily merry-go-round",
    hint: "10 members · 50 KES/day · 24-hour cycles · 30 rounds. Native to boda riders, market women, mama mbogas — the highest-frequency real ROSCA pattern.",
    icon: Sun,
    cycleSeconds: 24 * 60 * 60,
    openTimeoutSeconds: 24 * 60 * 60,
    rounds: 30,
    contribution: "0.5",
    memberCount: 10,
  },
  {
    id: "weekly",
    label: "Weekly chama",
    hint: "5 members · 20 cUSD/week · 7-day cycles · 12 rounds (≈3 months). Classic small-group cadence.",
    icon: CalendarClock,
    cycleSeconds: 7 * 24 * 60 * 60,
    openTimeoutSeconds: 7 * 24 * 60 * 60,
    rounds: 12,
    contribution: "20",
    memberCount: 5,
  },
  {
    id: "monthly",
    label: "Monthly chama",
    hint: "12 members · 100 cUSD/month · 30-day cycles · 1 round. The traditional rent-deposit / school-fees chama.",
    icon: Sailboat,
    cycleSeconds: 30 * 24 * 60 * 60,
    openTimeoutSeconds: 30 * 24 * 60 * 60,
    rounds: 1,
    contribution: "100",
    memberCount: 12,
  },
];

export function CreateChamaForm() {
  const navigate = useNavigate();
  const { address: connected } = useAccount();
  const { contracts, cUSDSymbol } = useActiveChain();
  const factoryAddr = contracts.ChamaFactory;
  const [members, setMembers] = useState<string[]>(["", "", ""]);
  const [contribution, setContribution] = useState("1");
  const [cycleSeconds, setCycleSeconds] = useState(cycleLengthPresets[0].seconds);
  const [openTimeoutSeconds, setOpenTimeoutSeconds] = useState(openTimeoutPresets[0].seconds);
  const [rounds, setRounds] = useState(1);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>("demo");

  function applyTemplate(t: Template) {
    setAppliedTemplate(t.id);
    setCycleSeconds(t.cycleSeconds);
    setOpenTimeoutSeconds(t.openTimeoutSeconds);
    setRounds(t.rounds);
    setContribution(t.contribution);
    setMembers((prev) => {
      // Keep whatever's already typed; pad with empties up to t.memberCount.
      const filled = prev.filter((m) => m.trim());
      const padding = Math.max(0, t.memberCount - filled.length);
      const next = [...filled, ...Array(padding).fill("")];
      return next.slice(0, 10);
    });
  }

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess, data: receipt, error: waitError } = useWaitForTransactionReceipt({ hash: txHash });

  const validation = useMemo(() => {
    const trimmed = members.map((m) => m.trim());
    const issues: string[] = [];
    if (trimmed.length < 2) issues.push("Need at least 2 members.");
    const nonEmpty = trimmed.filter(Boolean);
    if (nonEmpty.some((m) => !isAddress(m))) issues.push("One or more addresses are invalid.");
    if (new Set(nonEmpty.map((m) => m.toLowerCase())).size !== nonEmpty.length)
      issues.push("Duplicate member addresses.");
    if (Number(contribution) <= 0) issues.push("Contribution must be greater than 0.");
    return { nonEmpty, issues, valid: nonEmpty.length >= 2 && issues.length === 0 };
  }, [members, contribution]);

  function setMember(i: number, v: string) {
    setMembers((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }
  function addMember() {
    if (members.length < 10) setMembers((prev) => [...prev, ""]);
  }
  function removeMember(i: number) {
    if (members.length <= 2) return;
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  }

  const alreadyIncluded = !!(
    connected && members.some((m) => m.trim().toLowerCase() === connected.toLowerCase())
  );

  function addMyself() {
    if (!connected || alreadyIncluded) return;
    setMembers((prev) => {
      const firstEmpty = prev.findIndex((m) => !m.trim());
      if (firstEmpty >= 0) {
        return prev.map((m, idx) => (idx === firstEmpty ? connected : m));
      }
      if (prev.length < 10) return [...prev, connected];
      return prev;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factoryAddr || !validation.valid) return;
    const valueWei = parseUnits(contribution, 18);
    writeContract({
      address: factoryAddr,
      abi: chamaFactoryAbi,
      functionName: "createChama",
      args: [
        validation.nonEmpty as `0x${string}`[],
        valueWei,
        BigInt(cycleSeconds),
        BigInt(openTimeoutSeconds),
        BigInt(rounds),
      ],
    });
  }

  // When the receipt lands, parse out the ChamaCreated event to find the new chama address
  if (isSuccess && receipt && txHash) {
    for (const log of receipt.logs) {
      if (factoryAddr && log.address.toLowerCase() === factoryAddr.toLowerCase()) {
        try {
          const decoded = decodeEventLog({
            abi: chamaFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "ChamaCreated") {
            const newAddr = decoded.args.chama as string;
            // Defer to next tick so React doesn't moan about state updates in render
            queueMicrotask(() => {
              reset();
              navigate(`/chama/${newAddr}`);
            });
            return null;
          }
        } catch {
          // skip
        }
      }
    }
  }

  if (!factoryAddr) {
    return (
      <div className="surface px-6 py-8 text-sm text-[var(--color-fg-muted)]">
        ChamaFactory not deployed for this network. Deploy via{" "}
        <code className="font-mono text-[var(--color-fg)]">pnpm --filter @chama/contracts deploy-factory:sepolia</code>{" "}
        to enable this form.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="surface p-6 sm:p-7 space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            One click. Edit anything below.
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {templates.map((t) => {
            const active = appliedTemplate === t.id;
            const Icon = t.icon;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => applyTemplate(t)}
                className={cn(
                  "text-left rounded-xl border p-4 transition flex items-start gap-3",
                  active
                    ? "border-[var(--color-accent)]/55 bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] bg-white/[0.02] hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-lg shrink-0",
                    active
                      ? "bg-[var(--color-accent)] text-[#09090b]"
                      : "bg-white/[0.04] text-[var(--color-fg-muted)]",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", active && "text-[var(--color-accent)]")}>
                      {t.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)] leading-snug">{t.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <span className="text-xs text-[var(--color-fg-subtle)]">
            {members.filter((m) => m.trim()).length} of {members.length} filled · max 10
          </span>
        </div>
        <div className="space-y-2.5">
          {members.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <span className="grid size-9 place-items-center text-xs font-bold text-[var(--color-fg-subtle)] bg-white/[0.03] rounded-lg border border-[var(--color-border)] shrink-0">
                {i + 1}
              </span>
              <input
                type="text"
                value={m}
                onChange={(e) => setMember(i, e.target.value)}
                placeholder="0x…"
                className={cn(
                  "flex-1 font-mono text-sm rounded-lg border border-[var(--color-border)] bg-black/40 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]/40 transition",
                  m.trim() && !isAddress(m.trim()) && "border-[oklch(0.7_0.22_25/0.5)]",
                )}
              />
              <button
                type="button"
                onClick={() => removeMember(i)}
                disabled={members.length <= 2}
                className="grid size-9 place-items-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] disabled:opacity-30 transition-colors"
                aria-label="Remove member"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={addMember}
            disabled={members.length >= 10}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-40 transition-colors"
          >
            <Plus className="size-4" />
            Add another member
          </button>

          {connected && (
            <button
              type="button"
              onClick={addMyself}
              disabled={alreadyIncluded || (members.length >= 10 && members.every((m) => m.trim()))}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm transition-colors",
                alreadyIncluded
                  ? "text-[oklch(0.78_0.18_152)] cursor-default"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] disabled:opacity-40",
              )}
              title={
                alreadyIncluded
                  ? `${shortAddr(connected)} is already in the chama`
                  : `Add ${shortAddr(connected)} (your connected wallet)`
              }
            >
              <UserPlus className="size-4" />
              {alreadyIncluded
                ? `You're in (${shortAddr(connected)})`
                : `Add me (${shortAddr(connected)})`}
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface p-6 space-y-3">
          <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Contribution per cycle
          </label>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className="w-full text-3xl font-semibold tracking-tight bg-transparent focus:outline-none nums"
            />
            <span className="text-[var(--color-fg-muted)] text-sm">{cUSDSymbol}</span>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Each member contributes this amount every cycle. Same member receives the full pot once.
          </p>
        </div>

        <div className="surface p-6 space-y-3">
          <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Active-phase length
          </label>
          <div className="flex flex-wrap gap-1.5">
            {cycleLengthPresets.map((p) => {
              const active = cycleSeconds === p.seconds;
              return (
                <button
                  type="button"
                  key={p.seconds}
                  onClick={() => setCycleSeconds(p.seconds)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.03]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--color-fg-subtle)] leading-snug">
            How long the countdown ticks once <span className="text-[var(--color-fg-muted)]">every</span>{" "}
            member has paid in. The pot lands in the next payee at the end of this window.
          </p>
        </div>
      </section>

      <section className="surface p-6 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Rounds (how many times the pot rotates through everyone)
          </label>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] nums">
            {rounds * validation.nonEmpty.length || rounds * 3} total cycles
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {roundPresets.map((r) => {
            const active = rounds === r;
            return (
              <button
                type="button"
                key={r}
                onClick={() => setRounds(r)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition nums",
                  active
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.03]",
                )}
              >
                {r} {r === 1 ? "round" : "rounds"}
              </button>
            );
          })}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">custom</span>
            <input
              type="number"
              min={1}
              max={50}
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-16 rounded-md border border-[var(--color-border)] bg-black/40 px-2 py-1 text-xs nums focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-fg-subtle)] leading-snug">
          One round = one full pass through every member. After each round, anyone who's losing
          interest can simply stop contributing — defaulters surrender their share of that cycle's
          pot but the rotation continues for those who stay in.
        </p>
      </section>

      <section className="surface p-6 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Contribution window (force-advance fallback)
          </label>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {openTimeoutSeconds === 0 ? "Disabled — chama waits forever" : "Anyone can force-advance after this"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {openTimeoutPresets.map((p) => {
            const active = openTimeoutSeconds === p.seconds;
            return (
              <button
                type="button"
                key={p.seconds}
                onClick={() => setOpenTimeoutSeconds(p.seconds)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition",
                  active
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.03]",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--color-fg-subtle)] leading-snug">
          If the cycle stays in OPEN this long without every member contributing, anyone can force the
          cycle to advance with whatever's been collected. Defaulters are surfaced in events; the
          slot's payee still receives the partial pot.
        </p>
      </section>

      {validation.issues.length > 0 && (
        <div className="surface p-4 flex items-start gap-3 text-sm">
          <ShieldAlert className="size-4 text-[oklch(0.7_0.22_25)] mt-0.5 shrink-0" />
          <div className="space-y-1">
            {validation.issues.map((i) => (
              <div key={i} className="text-[var(--color-fg-muted)]">{i}</div>
            ))}
          </div>
        </div>
      )}

      {(writeError || waitError) && (
        <div className="surface p-4 text-sm text-[oklch(0.7_0.22_25)]">
          {writeError?.message?.split("\n")[0] ?? waitError?.message?.split("\n")[0]}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-[var(--color-fg-muted)] flex items-center gap-2 nums">
          <Sparkles className="size-3.5 text-[var(--color-accent)]" />
          {validation.nonEmpty.length} × {contribution || "0"} {cUSDSymbol} per cycle ·{" "}
          {validation.nonEmpty.length} cycles total
        </div>
        {!connected ? (
          <div className="rk-only">
            <ConnectButton label="Connect wallet to create" />
          </div>
        ) : (
          <button
            type="submit"
            disabled={!validation.valid || isPending || isMining}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#09090b] transition disabled:opacity-50 disabled:cursor-not-allowed",
              validation.valid && "hover:brightness-110",
            )}
          >
            {(isPending || isMining) && <Loader2 className="size-4 animate-spin" />}
            {isPending ? "Confirm in wallet…" : isMining ? "Deploying chama…" : "Create chama"}
          </button>
        )}
      </div>
    </form>
  );
}
