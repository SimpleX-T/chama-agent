import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Banknote, RotateCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { explorerTxForChain, formatUnits, shortAddr } from "@/lib/format";
import { useActiveChain } from "@/hooks/useActiveChain";
import type { ActivityEvent } from "@/hooks/useChamaActivity";

type Props = {
  events: ActivityEvent[];
  memberLabel: (addr: string) => string;
};

const kindMeta: Record<ActivityEvent["kind"], { icon: React.ComponentType<any>; color: string; label: string }> = {
  Contributed: {
    icon: ArrowRight,
    color: "text-[oklch(0.78_0.18_230)] bg-[oklch(0.78_0.18_230/0.1)] border-[oklch(0.78_0.18_230/0.3)]",
    label: "Contributed",
  },
  PayoutExecuted: {
    icon: Banknote,
    color: "text-[oklch(0.78_0.18_152)] bg-[oklch(0.78_0.18_152/0.1)] border-[oklch(0.78_0.18_152/0.3)]",
    label: "Payout",
  },
  CycleAdvanced: {
    icon: RotateCw,
    color: "text-[var(--color-fg-muted)] bg-white/5 border-[var(--color-border)]",
    label: "Cycle",
  },
  Defaulted: {
    icon: X,
    color: "text-[oklch(0.7_0.22_25)] bg-[oklch(0.7_0.22_25/0.1)] border-[oklch(0.7_0.22_25/0.3)]",
    label: "Defaulted",
  },
  ChamaCompleted: {
    icon: Sparkles,
    color: "text-[var(--color-accent)] bg-[var(--color-accent-soft)] border-[var(--color-accent)]/30",
    label: "Completed",
  },
};

export function ActivityFeed({ events, memberLabel }: Props) {
  const { chainId, cUSDSymbol } = useActiveChain();
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]/60">
        <h3 className="text-sm font-semibold tracking-tight">Activity</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] nums">
          {events.length} events
        </span>
      </div>
      <div className="divide-y divide-[var(--color-border)]/40">
        <AnimatePresence initial={false}>
          {events.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 py-8 text-center text-sm text-[var(--color-fg-subtle)]"
            >
              No events yet — agent will populate this as the chama runs.
            </motion.div>
          )}
          {events.map((e, i) => (
            <Row key={e.txHash + i} e={e} memberLabel={memberLabel} chainId={chainId} symbol={cUSDSymbol} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({
  e,
  memberLabel,
  chainId,
  symbol,
}: {
  e: ActivityEvent;
  memberLabel: (addr: string) => string;
  chainId: number;
  symbol: string;
}) {
  const meta = kindMeta[e.kind];
  const Icon = meta.icon;
  const who = e.member ?? e.payee;
  return (
    <motion.a
      href={explorerTxForChain(chainId, e.txHash)}
      target="_blank"
      rel="noreferrer"
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-white/[0.02] transition-colors group"
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-md border shrink-0",
          meta.color,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] w-16 shrink-0">
        {meta.label}
      </span>
      <div className="flex-1 min-w-0 text-[var(--color-fg-muted)]">
        <span className="text-[var(--color-fg)] font-medium">
          {e.kind === "ChamaCompleted"
            ? "All members paid"
            : e.kind === "CycleAdvanced"
              ? `→ cycle ${e.cycle.toString()}`
              : who
                ? memberLabel(who)
                : "—"}
        </span>
        {e.amount !== undefined && e.amount > 0n && (
          <span className="ml-2 nums">
            {e.kind === "PayoutExecuted" ? "received " : "in "}
            <span className="text-[var(--color-fg)] font-medium">{formatUnits(e.amount)}</span> {symbol}
          </span>
        )}
        {who && (
          <span className="ml-2 font-mono text-[10px] text-[var(--color-fg-subtle)]">
            {shortAddr(who)}
          </span>
        )}
      </div>
      <span className="font-mono text-[10px] text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] transition-colors shrink-0">
        {e.txHash.slice(0, 8)}…
      </span>
    </motion.a>
  );
}
