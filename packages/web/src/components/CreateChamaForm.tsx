import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Plus, ShieldAlert, Sparkles, X } from "lucide-react";
import { decodeEventLog, isAddress, parseUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CHAMA_FACTORY_ADDR, chamaFactoryAbi } from "@/lib/chain";
import { cn } from "@/lib/cn";

type Preset = { label: string; seconds: number };
const cycleLengthPresets: Preset[] = [
  { label: "5 minutes (demo)", seconds: 5 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "1 week", seconds: 7 * 24 * 60 * 60 },
];

export function CreateChamaForm() {
  const navigate = useNavigate();
  const { address: connected } = useAccount();
  const [members, setMembers] = useState<string[]>(["", "", ""]);
  const [contribution, setContribution] = useState("1");
  const [cycleSeconds, setCycleSeconds] = useState(cycleLengthPresets[0].seconds);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!CHAMA_FACTORY_ADDR || !validation.valid) return;
    const valueWei = parseUnits(contribution, 18);
    writeContract({
      address: CHAMA_FACTORY_ADDR,
      abi: chamaFactoryAbi,
      functionName: "createChama",
      args: [validation.nonEmpty as `0x${string}`[], valueWei, BigInt(cycleSeconds)],
    });
  }

  // When the receipt lands, parse out the ChamaCreated event to find the new chama address
  if (isSuccess && receipt && txHash) {
    for (const log of receipt.logs) {
      if (CHAMA_FACTORY_ADDR && log.address.toLowerCase() === CHAMA_FACTORY_ADDR.toLowerCase()) {
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

  if (!CHAMA_FACTORY_ADDR) {
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
        <button
          type="button"
          onClick={addMember}
          disabled={members.length >= 10}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-40 transition-colors"
        >
          <Plus className="size-4" />
          Add another member
        </button>
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
            <span className="text-[var(--color-fg-muted)] text-sm">mcUSD</span>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Each member contributes this amount every cycle. Same member receives the full pot once.
          </p>
        </div>

        <div className="surface p-6 space-y-3">
          <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Cycle length
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
        </div>
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
          {validation.nonEmpty.length} × {contribution || "0"} mcUSD per cycle ·{" "}
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
