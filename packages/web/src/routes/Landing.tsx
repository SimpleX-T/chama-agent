import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { ChamasList } from "@/components/ChamasList";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { RotationVisualizer } from "@/components/RotationVisualizer";
import { Stat } from "@/components/Stat";
import { CHAMA_ADDR, DEPLOY_MEMBERS } from "@/lib/chain";
import { useChamaState } from "@/hooks/useChamaState";
import { explorer, formatUnits, shortAddr } from "@/lib/format";

export function Landing() {
  const { data } = useChamaState(CHAMA_ADDR, 12_000);

  const placeholderMembers = useMemo(
    () => (data?.members ?? DEPLOY_MEMBERS) as readonly `0x${string}`[],
    [data?.members],
  );

  return (
    <>
      <Hero />

      <section className="px-5 sm:px-8 -mt-2 sm:-mt-4">
        <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[1fr_auto] items-center">
          <div className="order-2 lg:order-1 grid gap-3 sm:grid-cols-2 max-w-md">
            <Stat
              label="Status"
              value={
                !data ? "—" : data.completed ? "Completed" : `Cycle ${data.currentCycle.toString()} / ${data.memberCount.toString()}`
              }
              accent={data?.completed ? "green" : "gold"}
            />
            <Stat
              label="Pot this cycle"
              value={data ? `${formatUnits(data.potThisCycle)}` : "—"}
              hint="mcUSD"
            />
            <Stat
              label="Members"
              value={data ? data.memberCount.toString() : "—"}
              hint="3-member demo group"
            />
            <Stat
              label="Contribution"
              value={data ? formatUnits(data.contribution) : "—"}
              hint="mcUSD per cycle"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="order-1 lg:order-2 mx-auto w-full max-w-[520px]"
          >
            <RotationVisualizer
              members={placeholderMembers}
              currentCycle={data?.currentCycle ?? 0n}
              memberCount={data?.memberCount ?? BigInt(placeholderMembers.length)}
              contributedFlags={data?.contributedFlags ?? placeholderMembers.map(() => false)}
              potValue={data?.potThisCycle ?? 0n}
              contribution={data?.contribution ?? 0n}
              isActive={data?.isActive}
              completed={data?.completed}
              rounds={data?.rounds}
              totalCycles={data?.totalCycles}
            />
          </motion.div>
        </div>
      </section>

      <HowItWorks />

      <ChamasList />

      <section className="px-5 sm:px-8 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
                Featured
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">Live demo chama</h2>
            </div>
            <Link
              to="/chama/featured"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              Open detail view →
            </Link>
          </div>

          <div className="surface p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[2fr_3fr] items-center">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">3-member rotation</h3>
                <p className="mt-3 text-[var(--color-fg-muted)] leading-relaxed">
                  Three testnet wallets pooling 1 mcUSD per 5-minute cycle. Each member contributes
                  3×; each is paid the full pot once. End state: every member breaks even — but
                  three lump-sum payouts have happened, exactly when each member needed them.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                  {(data?.members ?? DEPLOY_MEMBERS).map((m, i) => (
                    <a
                      key={m}
                      href={explorer(m)}
                      target="_blank"
                      rel="noreferrer"
                      className="surface-tile px-3 py-2 flex items-center justify-between font-mono hover:text-[var(--color-accent)] transition-colors"
                    >
                      <span className="text-[var(--color-fg-subtle)]">M{i + 1}</span>
                      <span>{shortAddr(m)}</span>
                    </a>
                  ))}
                </div>
                <a
                  href={explorer(CHAMA_ADDR)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <span className="font-mono">{shortAddr(CHAMA_ADDR)}</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <div>
                <RotationVisualizer
                  members={placeholderMembers}
                  currentCycle={data?.currentCycle ?? 0n}
                  memberCount={data?.memberCount ?? BigInt(placeholderMembers.length)}
                  contributedFlags={data?.contributedFlags ?? placeholderMembers.map(() => false)}
                  potValue={data?.potThisCycle ?? 0n}
                  contribution={data?.contribution ?? 0n}
                  isActive={data?.isActive}
                  completed={data?.completed}
                  rounds={data?.rounds}
                  totalCycles={data?.totalCycles}
                  size={400}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
