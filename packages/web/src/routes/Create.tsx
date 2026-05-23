import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import { Link } from "react-router-dom";

export function Create() {
  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-16 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
          Coming next
        </p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight">
          Start your own chama
        </h1>
        <p className="mt-5 text-lg text-[var(--color-fg-muted)] max-w-2xl leading-relaxed">
          The <span className="text-[var(--color-fg)] font-medium">ChamaFactory</span> contract is
          the next phase. It will let any connected wallet deploy a fresh per-group escrow with
          custom members, contribution amount, and cycle length. Self ID verification will gate
          membership.
        </p>

        <div className="mt-10 surface p-8">
          <div className="flex items-start gap-4">
            <span
              className="grid size-12 place-items-center rounded-xl text-[var(--color-accent)] shrink-0"
              style={{ background: "var(--color-accent-soft)" }}
            >
              <Wrench className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">In the meantime</h2>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                The featured 3-member demo chama is live on Celo Sepolia. The full agent has driven
                a complete rotation on-chain. You can clone the repo and deploy a fresh chama
                yourself with one command — see the README.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link
                  to="/chama/featured"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-[var(--color-border)] px-3 py-1.5 hover:bg-white/[0.08] transition-colors"
                >
                  View the demo chama
                </Link>
                <a
                  href="https://github.com/SimpleX-T/chama-agent#quick-start"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] text-[#09090b] px-3 py-1.5 font-medium hover:brightness-110 transition"
                >
                  Quick-start guide
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
