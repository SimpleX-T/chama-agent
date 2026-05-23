import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "default" | "gold" | "green" | "red";
  className?: string;
};

const accentText = {
  default: "text-[var(--color-fg)]",
  gold: "text-[var(--color-accent)]",
  green: "text-[oklch(0.78_0.18_152)]",
  red: "text-[oklch(0.7_0.22_25)]",
};

export function Stat({ label, value, hint, accent = "default", className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface px-5 py-4", className)}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] font-medium">
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight nums", accentText[accent])}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-[var(--color-fg-muted)]">{hint}</div>}
    </motion.div>
  );
}
