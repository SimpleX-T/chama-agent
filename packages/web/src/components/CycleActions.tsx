import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, CircleDashed, Clock, Loader2, Sparkles, Users, Zap } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { chamaAbi } from "@/lib/chain";
import { useActiveChain } from "@/hooks/useActiveChain";
import { cn } from "@/lib/cn";
import { formatUnits, shortAddr } from "@/lib/format";

type Props = {
  chamaAddress: `0x${string}`;
  currentCycle: bigint;
  memberCount: bigint;
  contributedFlags: boolean[];
  cycleDeadline: bigint; // 0 if OPEN phase
  isActive: boolean;
  potThisCycle: bigint;
  payee: `0x${string}`;
  payeeIndex: number;
  contribution: bigint;
  completed: boolean;
  onRefresh?: () => void;
};

type Phase = "open" | "active" | "ready";

export function CycleActions({
  chamaAddress,
  currentCycle,
  memberCount,
  contributedFlags,
  cycleDeadline,
  isActive,
  potThisCycle,
  payee,
  payeeIndex,
  contribution,
  completed,
  onRefresh,
}: Props) {
  const { cUSDSymbol: symbol } = useActiveChain();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const paidCount = contributedFlags.filter(Boolean).length;
  const totalMembers = Number(memberCount);
  const remaining = Math.max(0, Number(cycleDeadline) - now);

  let phase: Phase;
  if (!isActive) phase = "open";
  else if (remaining > 0) phase = "active";
  else phase = "ready";

  const { writeContract, data: hash, isPending, reset, error } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) {
      onRefresh?.();
      reset();
    }
  }, [isSuccess, onRefresh, reset]);

  if (completed) return null;

  const Icon = phase === "open" ? Users : phase === "active" ? Clock : Zap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface p-6 sm:p-7",
        phase === "ready" && "ring-1 ring-[var(--color-accent)]/40",
      )}
      style={phase === "ready" ? { boxShadow: "var(--shadow-card), var(--shadow-glow)" } : undefined}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl shrink-0",
            phase === "ready" && "text-[var(--color-accent)]",
            phase === "active" && "text-[oklch(0.78_0.18_230)] bg-[oklch(0.78_0.18_230/0.1)]",
            phase === "open" && "text-[var(--color-fg-muted)] bg-white/[0.04]",
          )}
          style={phase === "ready" ? { background: "var(--color-accent-soft)" } : undefined}
        >
          <Icon className="size-5" />
        </span>

        <div className="flex-1 min-w-0">
          <PhasePill phase={phase} />

          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            {phase === "open" && `Cycle ${currentCycle.toString()} · collecting contributions`}
            {phase === "active" && `Cycle ${currentCycle.toString()} · payout in ${formatRemaining(remaining)}`}
            {phase === "ready" && `Cycle ${currentCycle.toString()} ready to pay out`}
          </h3>

          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed text-pretty">
            {phase === "open" && (
              <>
                <span className="text-[var(--color-fg)] font-medium">
                  {paidCount} of {totalMembers}
                </span>{" "}
                members have paid in. The countdown doesn't start until everyone contributes — the
                chama waits as long as it needs to. Once the last contribution lands,{" "}
                <span className="text-[var(--color-fg)] font-medium">{formatLength(contribution)}</span>{" "}
                begins ticking down to the payout for{" "}
                <span className="text-[var(--color-fg)] font-medium">MEMBER {payeeIndex + 1}</span>.
              </>
            )}
            {phase === "active" && (
              <>
                Every member has paid in. The pot of{" "}
                <span className="text-[var(--color-fg)] font-medium">
                  {formatUnits(potThisCycle)} {symbol}
                </span>{" "}
                is locked and will land in{" "}
                <span className="text-[var(--color-fg)] font-medium">MEMBER {payeeIndex + 1}</span> (
                <span className="font-mono">{shortAddr(payee)}</span>) when the timer ends. Anyone
                can trigger the payout at that moment — including you.
              </>
            )}
            {phase === "ready" && (
              <>
                Timer elapsed. Click below — or wait for the next on-chain interaction — to deliver{" "}
                <span className="text-[var(--color-fg)] font-medium">
                  {formatUnits(potThisCycle)} {symbol}
                </span>{" "}
                to <span className="text-[var(--color-fg)] font-medium">MEMBER {payeeIndex + 1}</span>{" "}
                and roll the chama into cycle {(currentCycle + 1n).toString()}.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                writeContract({
                  address: chamaAddress,
                  abi: chamaAbi,
                  functionName: "executePayout",
                })
              }
              disabled={phase !== "ready" || isPending || mining}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                phase === "ready"
                  ? "bg-[var(--color-accent)] text-[#09090b] hover:brightness-110"
                  : "bg-white/[0.04] text-[var(--color-fg-subtle)] cursor-not-allowed",
                (isPending || mining) && "opacity-80",
              )}
            >
              {isPending || mining ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Banknote className="size-4" />
              )}
              {isPending ? "Confirm in wallet…" : mining ? "Advancing cycle…" : "Execute payout"}
            </button>
          </div>

          {error && (
            <div className="mt-4 text-xs text-[oklch(0.7_0.22_25)] font-mono break-all">
              {error.message?.split("\n")[0]}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PhasePill({ phase }: { phase: Phase }) {
  const styles: Record<Phase, string> = {
    open: "border-[var(--color-border)] text-[var(--color-fg-muted)] bg-white/[0.03]",
    active:
      "border-[oklch(0.78_0.18_230/0.45)] text-[oklch(0.78_0.18_230)] bg-[oklch(0.78_0.18_230/0.08)]",
    ready: "border-[var(--color-accent)]/45 text-[var(--color-accent)] bg-[var(--color-accent-soft)]",
  };
  const label: Record<Phase, string> = {
    open: "OPEN · collecting",
    active: "ACTIVE · countdown ticking",
    ready: "READY · payout unlocked",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-medium",
        styles[phase],
      )}
    >
      {phase === "open" && <CircleDashed className="size-3" />}
      {phase === "active" && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {phase === "ready" && <Sparkles className="size-3" />}
      {label[phase]}
    </span>
  );
}

function formatRemaining(s: number) {
  if (s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatLength(_contribution: bigint) {
  // We don't have cycleLength as a prop, so we describe it qualitatively in copy.
  return "the cycle's window";
}
