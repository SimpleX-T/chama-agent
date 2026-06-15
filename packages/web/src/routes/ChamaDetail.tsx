import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CountdownRing } from "@/components/CountdownRing";
import { CycleActions } from "@/components/CycleActions";
import { MemberActions } from "@/components/MemberActions";
import { MemberCard } from "@/components/MemberCard";
import { RateAgentCard } from "@/components/RateAgentCard";
import { RotationVisualizer } from "@/components/RotationVisualizer";
import { ShareInviteButton } from "@/components/ShareInviteButton";
import { Stat } from "@/components/Stat";
import { useChamaActivity } from "@/hooks/useChamaActivity";
import { useChamaState } from "@/hooks/useChamaState";
import { useActiveChain } from "@/hooks/useActiveChain";
import { explorer, formatUnits, shortAddr } from "@/lib/format";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export function ChamaDetail() {
  const { address: paramAddress } = useParams<{ address: string }>();
  const { contracts, agentAddress, cUSDSymbol } = useActiveChain();
  // "featured" → newest factory chama if present, else the seed Chama if any, else null
  const address = (paramAddress && paramAddress !== "featured"
    ? (paramAddress as `0x${string}`)
    : (contracts.Chama ?? contracts.ChamaFactory ?? null));

  const { data, error, waitingForDeployment } = useChamaState(address ?? undefined);
  const { events } = useChamaActivity(address ?? ZERO_ADDRESS);

  const payedMembersThroughCycle = data && !data.completed ? Number(data.currentCycle) : data?.memberCount ?? 0n;

  const memberLabel = useMemo(
    () => (addr: string) => {
      if (!data) return "?";
      const i = data.members.findIndex((m) => m.toLowerCase() === addr.toLowerCase());
      return i >= 0 ? `MEMBER ${i + 1}` : shortAddr(addr);
    },
    [data?.members],
  );

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-24 space-y-12">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            Chama detail
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight">
            {data?.completed ? "Rotation complete" : "Live rotation"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {address && (
              <a
                href={explorer(address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                {address}
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {address && <ShareInviteButton address={address} />}
          </div>
        </div>
        {data && !data.completed && data.isActive && (
          <CountdownRing deadline={data.cycleDeadline} total={data.cycleLength} size={76} />
        )}
      </motion.header>

      {waitingForDeployment && (
        <div className="surface px-5 py-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span className="font-medium">Confirming on-chain…</span>
            <span className="text-[var(--color-fg-muted)]">
              the chama contract was just deployed — waiting for the public RPCs to catch up
            </span>
          </div>
        </div>
      )}

      {error && !waitingForDeployment && (
        <div className="surface px-5 py-4 border-[oklch(0.7_0.22_25/0.4)]! text-[oklch(0.7_0.22_25)] text-sm">
          RPC issue: {error}
        </div>
      )}

      {/* Top section: viz + stats */}
      <section className="grid gap-10 lg:grid-cols-[3fr_2fr] items-start">
        <div className="surface p-6 sm:p-10 flex items-center justify-center">
          {data ? (
            <RotationVisualizer
              members={data.members}
              currentCycle={data.currentCycle}
              memberCount={data.memberCount}
              contributedFlags={data.contributedFlags}
              potValue={data.potThisCycle}
              contribution={data.contribution}
              isActive={data.isActive}
              completed={data.completed}
              rounds={data.rounds}
              totalCycles={data.totalCycles}
              symbol={cUSDSymbol}
              size={520}
            />
          ) : (
            <div className="aspect-square w-full max-w-[520px] animate-pulse rounded-3xl bg-white/[0.02]" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat
            label="Status"
            value={
              !data
                ? "—"
                : data.completed
                  ? "Completed"
                  : `Cycle ${data.currentCycle.toString()} / ${data.totalCycles.toString()}`
            }
            hint={
              data && data.rounds > 1n
                ? `Round ${(data.currentRound + 1n).toString()} of ${data.rounds.toString()}`
                : undefined
            }
            accent={data?.completed ? "green" : "gold"}
          />
          <Stat
            label="Pot this cycle"
            value={data ? formatUnits(data.potThisCycle) : "—"}
            hint={cUSDSymbol}
          />
          <Stat
            label="Contribution"
            value={data ? formatUnits(data.contribution) : "—"}
            hint={`${cUSDSymbol} per member per cycle`}
          />
          <Stat
            label="Cycle length"
            value={data ? `${Number(data.cycleLength) / 60} min` : "—"}
          />
          <Stat
            label="Paid so far"
            value={data ? `${payedMembersThroughCycle.toString()}` : "—"}
            hint={data ? `of ${data.memberCount.toString()} members` : "—"}
          />
          <Stat
            label="Members"
            value={data ? data.memberCount.toString() : "—"}
            hint={
              data && data.rounds > 1n
                ? `${data.rounds.toString()}-round rotation`
                : "fixed-order rotation"
            }
          />
        </div>
      </section>

      {/* Cycle actions — permissionless trigger for whoever's around */}
      {address && data && !data.completed && (
        <section>
          <SectionHead title="Cycle status" hint="Permissionless — anyone can advance" />
          <CycleActions
            chamaAddress={address}
            currentCycle={data.currentCycle}
            memberCount={data.memberCount}
            contributedFlags={data.contributedFlags}
            cycleDeadline={data.cycleDeadline}
            isActive={data.isActive}
            potThisCycle={data.potThisCycle}
            payee={data.currentPayee}
            payeeIndex={Number(data.currentCycle)}
            contribution={data.contribution}
            completed={data.completed}
          />
        </section>
      )}

      {/* Member self-serve actions */}
      {address && data && !data.completed && (
        <section>
          <SectionHead title="Your participation" hint="Member-side onboarding" />
          <MemberActions
            chamaAddress={address}
            contribution={data.contribution}
            currentCycle={data.currentCycle}
          />
        </section>
      )}

      {/* Reputation attestation panel — appears as soon as one cycle has paid out */}
      {address && data && data.currentCycle > 0n && (
        <section>
          <SectionHead title="Reputation" hint="On-chain attestation · ERC-8004" />
          <RateAgentCard
            chamaAddress={address}
            currentCycle={data.currentCycle}
            lastPaidCycle={data.currentCycle - 1n}
          />
        </section>
      )}

      {/* Members */}
      <section>
        <SectionHead title="Members" hint="Tap to view on Blockscout" />
        {data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.members.map((m, i) => {
              const N = Number(data.memberCount);
              const curr = Number(data.currentCycle);
              const total = Number(data.totalCycles);
              const isPayee = !data.completed && curr % N === i && curr < total;
              // The next cycle index >= curr where this member is the payee
              let nextCycle: number | null = null;
              for (let c = i; c < total; c += N) {
                if (c >= curr) {
                  nextCycle = c;
                  break;
                }
              }
              return (
                <MemberCard
                  key={m}
                  index={i}
                  address={m}
                  balance={data.balances[i]}
                  contribution={data.contribution}
                  hasContributed={data.contributedFlags[i]}
                  isCurrentPayee={isPayee}
                  hasBeenPaid={nextCycle === null}
                  nextPayoutCycle={nextCycle}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface h-28 animate-pulse" />
            ))}
          </div>
        )}
      </section>

      {/* Activity */}
      <section>
        <SectionHead title="Recent activity" hint="On-chain events" />
        <ActivityFeed events={events} memberLabel={memberLabel} />
      </section>

      {/* Addresses */}
      <section>
        <SectionHead title="Contracts" />
        <div className="surface divide-y divide-[var(--color-border)]/60">
          {address && <AddrRow label="Chama" addr={address} />}
          <AddrRow label={cUSDSymbol} addr={contracts.cUSD} />
          {agentAddress && <AddrRow label="Agent wallet" addr={agentAddress} />}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {hint && <p className="text-xs text-[var(--color-fg-subtle)]">{hint}</p>}
    </div>
  );
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <a
      href={explorer(addr)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors group"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-xs text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors flex items-center gap-1.5">
        {addr}
        <ExternalLink className="size-3.5" />
      </span>
    </a>
  );
}
