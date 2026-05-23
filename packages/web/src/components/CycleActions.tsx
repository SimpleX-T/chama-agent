import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, Clock, Loader2, RotateCw, Zap } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { chamaAbi } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { formatUnits, shortAddr } from "@/lib/format";

type Props = {
  chamaAddress: `0x${string}`;
  currentCycle: bigint;
  memberCount: bigint;
  contributedFlags: boolean[];
  cycleDeadline: bigint;
  potThisCycle: bigint;
  payee: `0x${string}`;
  payeeIndex: number;
  contribution: bigint;
  completed: boolean;
  onRefresh?: () => void;
};

/**
 * Permissionless "advance the cycle" panel. Surfaces what the chama is
 * waiting on right now and offers the corresponding action — anyone
 * connected can press it (contract enforces all the safety rules).
 */
export function CycleActions({
  chamaAddress,
  currentCycle,
  memberCount,
  contributedFlags,
  cycleDeadline,
  potThisCycle,
  payee,
  payeeIndex,
  contribution,
  completed,
  onRefresh,
}: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const allContributed = contributedFlags.every(Boolean);
  const deadlinePassed = now >= Number(cycleDeadline);
  const cycleReady = !completed && (allContributed || deadlinePassed);
  const pendingCount = contributedFlags.filter((f) => !f).length;

  const { writeContract, data: hash, isPending, reset, error } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      onRefresh?.();
      reset();
    }
  }, [isSuccess, onRefresh, reset]);

  if (completed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface p-6 sm:p-7",
        cycleReady && "ring-1 ring-[var(--color-accent)]/40",
      )}
      style={cycleReady ? { boxShadow: "var(--shadow-card), var(--shadow-glow)" } : undefined}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl shrink-0",
            cycleReady
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-fg-muted)] bg-white/[0.04]",
          )}
          style={
            cycleReady ? { background: "var(--color-accent-soft)" } : undefined
          }
        >
          {cycleReady ? <Zap className="size-5" /> : <Clock className="size-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">
            {cycleReady
              ? `Cycle ${currentCycle.toString()} ready to advance`
              : `Cycle ${currentCycle.toString()} in progress`}
          </h3>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed text-pretty">
            {cycleReady ? (
              <>
                Trigger the payout: <span className="text-[var(--color-fg)] font-medium">{formatUnits(potThisCycle)} mcUSD</span>{" "}
                lands in <span className="text-[var(--color-fg)] font-medium">MEMBER {payeeIndex + 1}</span>{" "}
                (<span className="font-mono">{shortAddr(payee)}</span>). Anyone can call this —
                the contract enforces fixed payout order, the right amount, and the cycle
                advance. The courtesy agent will do it automatically if it's running, but you
                don't need it to be.
              </>
            ) : allContributed ? (
              <>All members are in — but the deadline hasn't elapsed yet. Hit "Execute payout" any time to finalize this cycle.</>
            ) : (
              <>
                Waiting on <span className="text-[var(--color-fg)] font-medium">{pendingCount}</span>{" "}
                of {memberCount.toString()} members to contribute. After the deadline elapses
                the cycle can be advanced with whatever was collected.
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
              disabled={!cycleReady || isPending || mining}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                cycleReady
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

            {!cycleReady && !allContributed && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
                <RotateCw className="size-3.5" />
                {Math.max(0, Number(cycleDeadline) - now)}s until permissionless trigger
              </span>
            )}
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
