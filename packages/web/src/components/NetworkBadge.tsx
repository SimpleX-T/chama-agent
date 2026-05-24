import { useChainId, useSwitchChain } from "wagmi";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { SUPPORTED_CHAINS } from "@/lib/chain";

/**
 * Compact network selector for the header. Shows the connected chain and
 * lets users flip between Celo mainnet and Celo Sepolia. Uses wagmi's
 * useSwitchChain so the wallet handles the actual switch.
 */
export function NetworkBadge() {
  const chainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const active =
    SUPPORTED_CHAINS.find((c) => c.id === chainId) ?? SUPPORTED_CHAINS[0];
  const isTestnet = (active as any).testnet === true;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition",
          isTestnet
            ? "border-[oklch(0.78_0.18_230/0.4)] bg-[oklch(0.78_0.18_230/0.08)] text-[oklch(0.78_0.18_230)]"
            : "border-[oklch(0.78_0.18_152/0.4)] bg-[oklch(0.78_0.18_152/0.08)] text-[oklch(0.78_0.18_152)]",
          isPending && "opacity-60",
        )}
        title={isTestnet ? "Testnet — uses mock cUSD" : "Mainnet — real cUSD"}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isTestnet
              ? "bg-[oklch(0.78_0.18_230)]"
              : "bg-[oklch(0.78_0.18_152)]",
          )}
        />
        <span className="font-medium">{isTestnet ? "Sepolia" : "Mainnet"}</span>
        <ChevronDown className="size-3" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-[calc(100%+6px)] z-40 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-md p-1 shadow-lg"
            >
              {chains.map((c) => {
                const selected = c.id === chainId;
                const testnet = (c as any).testnet === true;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      switchChain({ chainId: c.id });
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-md transition text-left",
                      selected
                        ? "bg-white/[0.05] text-[var(--color-fg)]"
                        : "text-[var(--color-fg-muted)] hover:bg-white/[0.03] hover:text-[var(--color-fg)]",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        testnet
                          ? "bg-[oklch(0.78_0.18_230)]"
                          : "bg-[oklch(0.78_0.18_152)]",
                      )}
                    />
                    <span className="flex-1">
                      {testnet ? "Celo Sepolia" : "Celo Mainnet"}
                    </span>
                    {selected && (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                        active
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="border-t border-[var(--color-border)] mt-1 pt-2 px-2.5 pb-1.5 text-[10px] leading-snug text-[var(--color-fg-subtle)]">
                Switching changes the wallet network. Mainnet uses real cUSD.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
