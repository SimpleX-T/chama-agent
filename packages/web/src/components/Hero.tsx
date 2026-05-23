import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import { ERC8004_AGENT_ID } from "@/lib/chain";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section className="relative pt-20 pb-12 sm:pt-28 sm:pb-16 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <Tag>
            <ShieldCheck className="size-3.5" />
            ERC-8004 · Agent #{ERC8004_AGENT_ID?.toString() ?? "274"}
          </Tag>
          <Tag>Celo Sepolia</Tag>
          <Tag>
            <Sparkles className="size-3 text-[var(--color-accent)]" />
            Live testnet
          </Tag>
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-4xl text-balance text-5xl sm:text-7xl font-semibold tracking-[-0.03em] leading-[0.95]"
        >
          The treasurer{" "}
          <span className="italic font-medium text-[var(--color-accent)]" style={{ fontFamily: "var(--font-serif)" }}>
            is a contract.
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-2xl text-balance text-[var(--color-fg-muted)] text-lg sm:text-xl leading-relaxed"
        >
          ChamaAgent runs trustless rotating savings groups on Celo. Members pool cUSD on a schedule;
          the full pot rotates to each member in turn. An ERC-8004 agent operates the workflow{" "}
          <span className="text-[var(--color-fg)]">and never touches your money.</span>
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/chama/featured"
            className="group inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#09090b] hover:brightness-110 transition"
          >
            View the live chama
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            to="/create"
            className="group inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-[var(--color-fg)] hover:bg-white/[0.06] transition"
          >
            Start a chama
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <a
            href="https://github.com/SimpleX-T/chama-agent"
            target="_blank"
            rel="noreferrer"
            className="ml-1 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Read the source →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[var(--color-fg-muted)] backdrop-blur">
      {children}
    </span>
  );
}
