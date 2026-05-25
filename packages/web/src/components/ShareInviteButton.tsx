import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Chama address. The shared URL routes to /chama/<address> on this deployment. */
  address: `0x${string}` | string;
  className?: string;
};

/**
 * One-click share-the-invite button. Copies the full chama-detail URL to
 * the clipboard. Members open the URL on their phone or laptop, connect
 * the wallet that was added as a member, and get the Step 1/2/3 guided
 * flow automatically — no out-of-band coordination needed.
 *
 * For real-world chamas you'd then forward the URL via WhatsApp / SMS /
 * Telegram / MiniPay's share intent. The browser's native share sheet is
 * used when available for that one-tap flow.
 */
export function ShareInviteButton({ address, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/chama/${address}`
        : `/chama/${address}`;
    const title = "Join this chama on ChamaAgent";
    const text =
      "You've been added as a member. Open this link, connect your wallet, and you'll be guided through fund → approve → pay in.";

    // Mobile native share sheet when present (works in MiniPay too)
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        return;
      } catch {
        /* user cancelled or share not available — fall through to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — show URL in prompt as last resort */
      window.prompt("Copy this invite link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.06] transition",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-1.5 text-[oklch(0.78_0.18_152)]"
          >
            <Check className="size-3.5" />
            Copied
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-1.5"
          >
            <Share2 className="size-3.5" />
            Share invite
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
