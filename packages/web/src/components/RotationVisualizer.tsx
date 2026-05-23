import { useMemo } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "@/lib/format";

type Props = {
  members: readonly `0x${string}`[];
  currentCycle: bigint;
  memberCount: bigint;
  contributedFlags: boolean[];
  potValue: bigint;
  contribution: bigint;
  completed?: boolean;
  size?: number;
};

/**
 * The centerpiece. N member nodes arranged on a circle around a central pot.
 *  - Active payee glows + scales up.
 *  - Members who contributed this cycle pulse a soft green ring + an animated
 *    dashed line drawn from them to the pot.
 *  - Pot label shows live pot value for the active cycle.
 *  - When the chama completes, the whole graph dims and the pot shows a
 *    satisfaction tick.
 */
export function RotationVisualizer({
  members,
  currentCycle,
  memberCount,
  contributedFlags,
  potValue,
  contribution,
  completed,
  size = 560,
}: Props) {
  const N = Number(memberCount);
  const radius = size * 0.36;
  const center = size / 2;
  const nodeRadius = Math.max(28, Math.min(46, (radius * Math.PI) / (N * 1.4)));

  const positions = useMemo(() => {
    return members.map((_, i) => {
      const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
      return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
    });
  }, [members.length, N, radius, center]);

  const payeeIdx = !completed && currentCycle < BigInt(N) ? Number(currentCycle) : -1;

  return (
    <div
      className="relative aspect-square w-full max-w-[var(--max,560px)]"
      style={{ ["--max" as any]: `${size}px` }}
    >
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.86 0.18 90 / 0.18), transparent 60%)",
        }}
      />

      <svg viewBox={`0 0 ${size} ${size}`} className="size-full">
        <defs>
          <linearGradient id="potGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="60%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <radialGradient id="potShine" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* faint orbit ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
        />

        {/* contribution flows (member -> pot), one per contributed member */}
        {contributedFlags.map((on, i) => {
          if (!on) return null;
          const p = positions[i];
          return (
            <motion.line
              key={`flow-${i}`}
              x1={p.x}
              y1={p.y}
              x2={center}
              y2={center}
              stroke="oklch(0.78 0.18 152 / 0.5)"
              strokeWidth={1.5}
              strokeDasharray="3 6"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
            />
          );
        })}

        {/* central pot */}
        <motion.g
          initial={false}
          animate={{ scale: completed ? 0.92 : 1 }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        >
          <circle cx={center} cy={center} r={68} fill="url(#potGold)" />
          <circle cx={center} cy={center} r={68} fill="url(#potShine)" />
          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={26}
            fontWeight={800}
            fill="#09090b"
            className="nums"
          >
            {formatUnits(potValue, 18, 2)}
          </text>
          <text
            x={center}
            y={center + 18}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={11}
            fontWeight={600}
            fill="#09090b"
            opacity={0.65}
            letterSpacing="0.1em"
          >
            POT · mcUSD
          </text>
        </motion.g>

        {/* member nodes */}
        {members.map((addr, i) => {
          const p = positions[i];
          const isPayee = i === payeeIdx;
          const hasContributed = contributedFlags[i];
          return (
            <g key={addr}>
              {/* glow ring for the active payee */}
              {isPayee && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={nodeRadius + 10}
                  fill="none"
                  stroke="#FCD34D"
                  strokeWidth={1.5}
                  animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
              )}

              {/* contribution-confirmed ring */}
              {hasContributed && !isPayee && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={nodeRadius + 5}
                  fill="none"
                  stroke="oklch(0.78 0.18 152 / 0.4)"
                  strokeWidth={1.5}
                />
              )}

              <motion.circle
                cx={p.x}
                cy={p.y}
                r={nodeRadius}
                fill={
                  isPayee
                    ? "#FCD34D"
                    : hasContributed
                      ? "oklch(0.78 0.18 152 / 0.12)"
                      : "oklch(0.205 0 0 / 0.9)"
                }
                stroke={
                  isPayee
                    ? "transparent"
                    : hasContributed
                      ? "oklch(0.78 0.18 152 / 0.55)"
                      : "oklch(0.371 0 0)"
                }
                strokeWidth={1.5}
                animate={{ scale: isPayee ? 1.06 : 1 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />

              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontSize={16}
                fontWeight={700}
                fill={isPayee ? "#09090b" : "oklch(0.985 0 0)"}
              >
                {i + 1}
              </text>
              <text
                x={p.x}
                y={p.y + nodeRadius + 18}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill="oklch(0.708 0 0)"
              >
                {`${addr.slice(0, 5)}…${addr.slice(-3)}`}
              </text>
            </g>
          );
        })}

        {/* completion checkmark */}
        {completed && (
          <motion.path
            d={`M ${center - 18} ${center} l 12 12 l 24 -24`}
            fill="none"
            stroke="#09090b"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          />
        )}
      </svg>

      {/* corner badge with cycle index */}
      <div className="pointer-events-none absolute top-1 left-1 surface-tile px-3 py-1.5 text-xs">
        <span className="text-[var(--color-fg-subtle)] mr-2">CYCLE</span>
        <span className="nums">{completed ? "—" : currentCycle.toString()} / {memberCount.toString()}</span>
      </div>

      {!completed && (
        <div className="pointer-events-none absolute top-1 right-1 surface-tile px-3 py-1.5 text-xs nums">
          <span className="text-[var(--color-fg-subtle)] mr-2">CONTRIB</span>
          {formatUnits(contribution)} mcUSD
        </div>
      )}

      {!completed && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 surface-tile px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]">
          {(() => {
            const paid = contributedFlags.filter(Boolean).length;
            if (paid < members.length)
              return (
                <span className="text-[var(--color-fg-muted)]">
                  {paid}/{members.length} paid in
                </span>
              );
            return <span className="text-[oklch(0.78_0.18_230)]">cycle active · waiting for timer</span>;
          })()}
        </div>
      )}
    </div>
  );
}
