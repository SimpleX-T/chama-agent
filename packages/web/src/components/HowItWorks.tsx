import { motion } from "framer-motion";
import { Coins, RotateCw, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: ShieldCheck,
    title: "Verify",
    body:
      "Members prove humanity via Self Agent ID — a ZK passport check that confirms a unique real person without revealing PII.",
  },
  {
    icon: Coins,
    title: "Pool",
    body:
      "A per-group Solidity contract escrows cUSD. Members approve the contract directly — the agent has no key to your funds.",
  },
  {
    icon: RotateCw,
    title: "Rotate",
    body:
      "An ERC-8004 agent operates the cycle: pulls each member's contribution, pushes the full pot to the next member in turn, advances.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-5 sm:px-8 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
            How it works
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Three on-chain steps. Zero trusted intermediaries.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="surface p-6 relative"
            >
              <div className="flex items-center justify-between">
                <span
                  className="grid size-10 place-items-center rounded-xl text-[var(--color-accent)]"
                  style={{ background: "var(--color-accent-soft)" }}
                >
                  <s.icon className="size-5" />
                </span>
                <span className="text-2xl font-semibold text-[var(--color-fg-subtle)] tabular-nums">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
