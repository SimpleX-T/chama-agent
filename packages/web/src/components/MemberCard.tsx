import { motion } from "framer-motion";
import { AlertCircle, Check, Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { explorer, formatUnits, shortAddr } from "@/lib/format";

type Props = {
  index: number;
  address: `0x${string}`;
  balance: bigint;
  contribution: bigint;
  hasContributed: boolean;
  isCurrentPayee: boolean;
  hasBeenPaid: boolean;
  /** Index of the *next* cycle in which this member will receive the pot, or null if done. */
  nextPayoutCycle: number | null;
};

export function MemberCard({
  index,
  address,
  balance,
  contribution,
  hasContributed,
  isCurrentPayee,
  hasBeenPaid,
  nextPayoutCycle,
}: Props) {
  const insufficientBalance = !hasContributed && balance < contribution;
  const shortfall = contribution - balance;

  let cycleHint: { label: string; tone: "gold" | "green" | "muted" };
  if (isCurrentPayee) cycleHint = { label: "Receives this cycle's pot", tone: "gold" };
  else if (nextPayoutCycle !== null)
    cycleHint = { label: `Next payout in cycle ${nextPayoutCycle}`, tone: "muted" };
  else if (hasBeenPaid) cycleHint = { label: "All payouts received", tone: "green" };
  else cycleHint = { label: "—", tone: "muted" };

  return (
    <motion.a
      href={explorer(address)}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative block surface px-5 py-4 transition-colors",
        isCurrentPayee && "ring-1 ring-[var(--color-accent)]/60",
      )}
      style={isCurrentPayee ? { boxShadow: "var(--shadow-card), var(--shadow-glow)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar idx={index} highlight={isCurrentPayee} />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              MEMBER {index + 1}
              {isCurrentPayee && <Crown className="size-3.5 text-[var(--color-accent)]" />}
              {hasBeenPaid && !isCurrentPayee && <Check className="size-3.5 text-[oklch(0.78_0.18_152)]" />}
            </div>
            <div className="font-mono text-xs text-[var(--color-fg-muted)] truncate">
              {shortAddr(address)}
            </div>
          </div>
        </div>
        <ContribDot hasContributed={hasContributed} />
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          balance
        </span>
        <span className="text-sm font-semibold nums">
          {formatUnits(balance)}{" "}
          <span className="text-[var(--color-fg-subtle)] font-normal">mcUSD</span>
        </span>
      </div>

      <div
        className={cn(
          "mt-2 text-[11px] font-medium",
          cycleHint.tone === "gold" && "text-[var(--color-accent)]",
          cycleHint.tone === "green" && "text-[oklch(0.78_0.18_152)]",
          cycleHint.tone === "muted" && "text-[var(--color-fg-subtle)]",
        )}
      >
        {cycleHint.label}
      </div>

      {insufficientBalance && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-[oklch(0.7_0.22_25/0.35)] bg-[oklch(0.7_0.22_25/0.05)] px-2.5 py-2 text-[11px] text-[oklch(0.85_0.18_25)]">
          <AlertCircle className="size-3.5 mt-px shrink-0" />
          <span className="leading-snug">
            Needs <span className="font-semibold nums">{formatUnits(shortfall)}</span> more mcUSD to pay
            in. Their wallet must mint &amp; approve from the chama page.
          </span>
        </div>
      )}
    </motion.a>
  );
}

function Avatar({ idx, highlight }: { idx: number; highlight: boolean }) {
  const palette = [
    "oklch(0.86 0.18 90)",   // gold
    "oklch(0.78 0.18 230)",  // sky
    "oklch(0.78 0.18 152)",  // green
    "oklch(0.78 0.22 25)",   // coral
    "oklch(0.78 0.18 305)",  // violet
    "oklch(0.86 0.18 75)",
    "oklch(0.78 0.18 200)",
    "oklch(0.78 0.18 110)",
  ];
  const c = palette[idx % palette.length];
  return (
    <div
      className={cn(
        "relative grid size-9 place-items-center rounded-full text-[11px] font-bold text-[#09090b] shrink-0",
        highlight && "ring-2 ring-[var(--color-accent)]/40 ring-offset-2 ring-offset-[var(--color-bg)]",
      )}
      style={{ background: c }}
    >
      {idx + 1}
    </div>
  );
}

function ContribDot({ hasContributed }: { hasContributed: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase",
          hasContributed
            ? "border-[oklch(0.78_0.18_152/0.4)] text-[oklch(0.78_0.18_152)] bg-[oklch(0.78_0.18_152/0.08)]"
            : "border-[var(--color-border)] text-[var(--color-fg-subtle)]",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            hasContributed ? "bg-[oklch(0.78_0.18_152)]" : "bg-[var(--color-border-strong)]",
          )}
        />
        {hasContributed ? "paid in" : "pending"}
      </span>
    </div>
  );
}
