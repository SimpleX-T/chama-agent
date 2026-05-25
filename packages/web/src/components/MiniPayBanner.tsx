import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { useMiniPay } from "@/hooks/useMiniPay";

/**
 * Header banner that flips on automatically when the dapp is opened
 * inside MiniPay's WebView. Tiny, unobtrusive — its real job is to
 * confirm the integration is live for MiniPay tracking / bonus points.
 */
export function MiniPayBanner() {
  const isMiniPay = useMiniPay();
  if (!isMiniPay) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-r from-[oklch(0.78_0.18_152/0.12)] to-[oklch(0.86_0.18_90/0.12)] border-b border-[oklch(0.78_0.18_152/0.3)]"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-2 flex items-center gap-2.5 text-xs">
        <span
          className="grid size-5 place-items-center rounded-md text-[oklch(0.78_0.18_152)]"
          style={{ background: "oklch(0.78 0.18 152 / 0.15)" }}
        >
          <Smartphone className="size-3" />
        </span>
        <span className="text-[var(--color-fg)] font-medium">Optimized for MiniPay</span>
        <span className="text-[var(--color-fg-muted)] hidden sm:inline">
          · auto-connected · cUSD-native · mobile-first chama flow
        </span>
      </div>
    </motion.div>
  );
}
