import { motion } from "framer-motion";
import { CreateChamaForm } from "@/components/CreateChamaForm";

export function Create() {
  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-16 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
          New chama
        </p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight">
          Start your own chama
        </h1>
        <p className="mt-5 text-lg text-[var(--color-fg-muted)] max-w-2xl leading-relaxed text-balance">
          One transaction deploys a per-group escrow contract. The same{" "}
          <span className="text-[var(--color-fg)] font-medium">ChamaAgent #274</span> will operate it
          alongside the demo. Members approve the new contract directly when they're ready to
          participate — and their funds never leave the escrow except into the rotation.
        </p>

        <div className="mt-12">
          <CreateChamaForm />
        </div>
      </motion.div>
    </div>
  );
}
