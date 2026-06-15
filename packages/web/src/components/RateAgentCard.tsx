import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useAccount, useBlockNumber, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { reputationRegistryAbi } from "@/lib/chain";
import { useActiveChain } from "@/hooks/useActiveChain";
import { cn } from "@/lib/cn";

type Props = {
  chamaAddress: `0x${string}`;
  currentCycle: bigint;
  lastPaidCycle: bigint | null; // cycle index of the most recently completed payout (or null)
};

/**
 * Member-side panel for posting reputation attestations to the ERC-8004
 * Reputation Registry. After every payout, the connected member can rate
 * the agent's performance for that cycle. Each rating is its own on-chain
 * tx — multiplies activity AND lifts the agent's 8004scan rank.
 *
 * Self-feedback is blocked at the registry level (the agent's owner can't
 * attest to itself), so this button no-ops if the connected wallet is the
 * agent operator.
 */
export function RateAgentCard({ chamaAddress, currentCycle, lastPaidCycle }: Props) {
  const { address, isConnected } = useAccount();
  const { erc8004, explorer } = useActiveChain();
  const REPUTATION = erc8004.reputationRegistry;
  const AGENT_ID = erc8004.agentId ?? 0n;
  const [selected, setSelected] = useState<5 | 4 | 3 | null>(null);

  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { data: lastIndex, refetch } = useReadContract({
    address: REPUTATION,
    abi: reputationRegistryAbi,
    functionName: "getLastIndex",
    args: address && AGENT_ID > 0n ? [AGENT_ID, address] : undefined,
    query: { enabled: !!address && AGENT_ID > 0n },
  });
  useEffect(() => {
    if (address) refetch();
  }, [blockNumber, address, refetch]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) {
      refetch();
      setSelected(null);
    }
  }, [isSuccess, refetch]);

  if (lastPaidCycle === null) return null; // no cycle has paid out yet
  const paidCycle = lastPaidCycle;

  const submitted = isSuccess;
  const attestedCountTotal = lastIndex ? Number(lastIndex as bigint) : 0;

  function submit(score: 5 | 4 | 3) {
    if (!address || AGENT_ID === 0n) return;
    setSelected(score);
    writeContract({
      address: REPUTATION,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [
        AGENT_ID,
        BigInt(score * 20), // 5 → 100, 4 → 80, 3 → 60
        0,
        "rosca-cycle",
        `cycle-${paidCycle.toString()}`,
        `${explorer}/address/${chamaAddress}`,
        "",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface p-6 sm:p-7"
    >
      <div className="flex items-start gap-4">
        <span
          className="grid size-11 place-items-center rounded-xl text-[var(--color-accent)] shrink-0"
          style={{ background: "var(--color-accent-soft)" }}
        >
          <Star className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">
            Rate the agent — cycle {paidCycle.toString()}
          </h3>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed text-pretty">
            Post an on-chain attestation to{" "}
            <a
              href={`https://8004scan.io/agents/${erc8004.scanSlug}/${AGENT_ID.toString()}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-fg)] font-medium underline-offset-2 hover:underline"
            >
              Agent #{AGENT_ID.toString()}
            </a>{" "}
            via the ERC-8004 Reputation Registry. Higher scores lift the agent's 8004scan rank;
            future chamas read this when choosing an operator. Self-attestation is blocked at
            the registry level, so the agent can't farm its own reputation.
          </p>

          {!isConnected ? (
            <div className="mt-4">
              <ConnectButton label="Connect to rate" showBalance={false} />
            </div>
          ) : submitted ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[oklch(0.78_0.18_152/0.4)] bg-[oklch(0.78_0.18_152/0.08)] px-3 py-2 text-sm text-[oklch(0.78_0.18_152)]">
              <CheckCircle2 className="size-4" />
              Rating posted on-chain · total attestations from you: {attestedCountTotal}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {([5, 4, 3] as const).map((s) => {
                  const labels = { 5: "Smooth", 4: "Okay", 3: "Could be better" };
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      disabled={isPending || mining}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                        selected === s
                          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "border-[var(--color-border)] text-[var(--color-fg)] hover:bg-white/[0.04]",
                        (isPending || mining) && selected === s && "opacity-70",
                      )}
                    >
                      {(isPending || mining) && selected === s ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <span className="flex gap-0.5">
                          {Array.from({ length: s }).map((_, i) => (
                            <Star key={i} className="size-3.5 fill-current" />
                          ))}
                        </span>
                      )}
                      <span>{labels[s]}</span>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] nums">
                        {s * 20}/100
                      </span>
                    </button>
                  );
                })}
              </div>
              {error && (
                <div className="text-xs text-[oklch(0.7_0.22_25)] font-mono break-all">
                  {error.message?.split("\n")[0]}
                </div>
              )}
              {attestedCountTotal > 0 && (
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  You've posted {attestedCountTotal} attestation
                  {attestedCountTotal === 1 ? "" : "s"} to this agent before.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
