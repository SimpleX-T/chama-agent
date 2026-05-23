import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useFactoryChamas, type FactoryChama } from "@/hooks/useFactoryChamas";
import { chamaAbi, publicClient } from "@/lib/chain";
import { formatUnits, relativeTime, shortAddr } from "@/lib/format";

type Decorated = FactoryChama & {
  memberCount?: bigint;
  contribution?: bigint;
  currentCycle?: bigint;
  completed?: boolean;
};

export function ChamasList() {
  const { data: chamas } = useFactoryChamas(12);
  const [decorated, setDecorated] = useState<Decorated[]>([]);

  useEffect(() => {
    let alive = true;
    if (chamas.length === 0) {
      setDecorated([]);
      return;
    }
    (async () => {
      const next = await Promise.all(
        chamas.map(async (c): Promise<Decorated> => {
          try {
            const [memberCount, contribution, currentCycle] = (await Promise.all([
              publicClient.readContract({ address: c.address, abi: chamaAbi, functionName: "memberCount" }),
              publicClient.readContract({ address: c.address, abi: chamaAbi, functionName: "contribution" }),
              publicClient.readContract({ address: c.address, abi: chamaAbi, functionName: "currentCycle" }),
            ])) as [bigint, bigint, bigint];
            return {
              ...c,
              memberCount,
              contribution,
              currentCycle,
              completed: currentCycle >= memberCount,
            };
          } catch {
            return c;
          }
        }),
      );
      if (alive) setDecorated(next);
    })();
    return () => {
      alive = false;
    };
  }, [chamas]);

  if (chamas.length === 0) return null;

  return (
    <section className="px-5 sm:px-8 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
              Factory
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">All chamas</h2>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
          >
            Start a new one
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decorated.map((c, i) => {
            const now = Math.floor(Date.now() / 1000);
            const age = now - Number(c.createdAt);
            return (
              <motion.div
                key={c.address}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to={`/chama/${c.address}`}
                  className="block surface p-5 transition hover:bg-white/[0.02] group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={
                        c.completed
                          ? "inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.78_0.18_152/0.1)] border border-[oklch(0.78_0.18_152/0.3)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[oklch(0.78_0.18_152)]"
                          : "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-accent)]"
                      }
                    >
                      <span
                        className={
                          c.completed
                            ? "size-1.5 rounded-full bg-[oklch(0.78_0.18_152)]"
                            : "size-1.5 rounded-full bg-[var(--color-accent)] animate-pulse"
                        }
                      />
                      {c.completed ? "Completed" : c.currentCycle !== undefined ? `Cycle ${c.currentCycle.toString()}` : "Active"}
                    </span>
                    <ArrowUpRight className="size-3.5 text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] transition-colors" />
                  </div>

                  <div className="mt-4 font-mono text-xs text-[var(--color-fg-muted)]">
                    {shortAddr(c.address)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Cell label="Members" value={c.memberCount?.toString() ?? "—"} />
                    <Cell
                      label="Contrib"
                      value={c.contribution !== undefined ? `${formatUnits(c.contribution)} mcUSD` : "—"}
                    />
                  </div>

                  <div className="mt-4 text-xs text-[var(--color-fg-subtle)]">
                    {age >= 0 ? `created ${relativeTime(age)}` : "just now"}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{label}</div>
      <div className="font-semibold nums">{value}</div>
    </div>
  );
}
