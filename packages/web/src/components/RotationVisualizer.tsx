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
  isActive?: boolean;
  rounds?: bigint;
  totalCycles?: bigint;
  size?: number;
};

/**
 * The centerpiece visual. Three states for the chama show up here:
 *  - OPEN — collecting contributions; a small subset of members glow green,
 *    the rest sit in dark wells. Flow particles travel periodically from
 *    contributors to the pot. Outer orbit rotates softly to signal life.
 *  - ACTIVE — every member is in. A dashed "lock" ring closes around the
 *    pot and slowly counter-rotates. The payee's node wears a crown.
 *  - COMPLETED — pot dims, a check mark animates in.
 */
export function RotationVisualizer({
  members,
  currentCycle,
  memberCount,
  contributedFlags,
  potValue,
  contribution,
  completed,
  isActive,
  rounds,
  totalCycles,
  size = 560,
}: Props) {
  const N = Number(memberCount);
  const radius = size * 0.34;
  const center = size / 2;
  const nodeRadius = Math.max(28, Math.min(46, (radius * Math.PI) / (N * 1.4)));

  const positions = useMemo(() => {
    return members.map((_, i) => {
      const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
      return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
    });
  }, [members.length, N, radius, center]);

  const totalN = totalCycles ? Number(totalCycles) : N;
  const payeeIdx = !completed && currentCycle < BigInt(totalN) ? Number(currentCycle % BigInt(N)) : -1;
  const roundsN = rounds ? Number(rounds) : 1;
  const roundIdx = N > 0 ? Math.floor(Number(currentCycle) / N) : 0;
  const paidCount = contributedFlags.filter(Boolean).length;
  const cycleActive = !!isActive;

  return (
    <div
      className="relative aspect-square w-full max-w-[var(--max,560px)]"
      style={{ ["--max" as any]: `${size}px` }}
    >
      {/* Ambient glow behind the canvas */}
      <motion.div
        className="absolute inset-0 -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.86 0.18 90 / 0.22), transparent 60%)",
        }}
        animate={{ opacity: cycleActive ? [0.45, 0.7, 0.45] : [0.35, 0.55, 0.35] }}
        transition={{ duration: cycleActive ? 3 : 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg viewBox={`0 0 ${size} ${size}`} className="size-full">
        <defs>
          <linearGradient id="potGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="55%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <radialGradient id="potShine" cx="50%" cy="30%" r="55%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id="potDim" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="oklch(0.205 0 0)" />
            <stop offset="100%" stopColor="oklch(0.145 0 0)" />
          </radialGradient>
          <radialGradient id="nodeContrib" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="oklch(0.78 0.18 152 / 0.22)" />
            <stop offset="100%" stopColor="oklch(0.78 0.18 152 / 0.04)" />
          </radialGradient>
          <radialGradient id="nodePending" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="oklch(0.23 0 0)" />
            <stop offset="100%" stopColor="oklch(0.155 0 0)" />
          </radialGradient>
          <radialGradient id="nodePayee" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="55%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* Slowly-rotating outer track with tick marks */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        >
          <circle
            cx={center}
            cy={center}
            r={radius * 1.18}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            strokeDasharray="3 14"
          />
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const r = radius * 1.18;
            const x = center + r * Math.cos(a);
            const y = center + r * Math.sin(a);
            return <circle key={i} cx={x} cy={y} r={0.8} fill="rgba(255,255,255,0.12)" />;
          })}
        </motion.g>

        {/* Counter-rotating inner halo when cycle is active */}
        {cycleActive && !completed && (
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${center}px ${center}px` }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius * 1.05}
              fill="none"
              stroke="oklch(0.86 0.18 90 / 0.18)"
              strokeWidth={1}
              strokeDasharray="2 8"
            />
          </motion.g>
        )}

        {/* The inner member orbit (the path the nodes sit on) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />

        {/* Faint connection lines from contributors to pot */}
        {contributedFlags.map((on, i) => {
          if (!on) return null;
          const p = positions[i];
          const isPayee = i === payeeIdx;
          return (
            <motion.line
              key={`line-${i}`}
              x1={p.x}
              y1={p.y}
              x2={center}
              y2={center}
              stroke={isPayee ? "oklch(0.86 0.18 90 / 0.4)" : "oklch(0.78 0.18 152 / 0.35)"}
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
            />
          );
        })}

        {/* Contribution flow particles — gentle, periodic pulse along each contributed line */}
        {contributedFlags.map((on, i) => {
          if (!on || completed) return null;
          const p = positions[i];
          const isPayee = i === payeeIdx;
          const tx = center - (center - p.x) * 0.18; // particle disappears near the pot rim
          const ty = center - (center - p.y) * 0.18;
          return (
            <motion.circle
              key={`pulse-${i}`}
              r={2.4}
              fill={isPayee ? "#FEF3C7" : "oklch(0.78 0.18 152)"}
              filter="url(#softGlow)"
              initial={{ cx: p.x, cy: p.y, opacity: 0 }}
              animate={{
                cx: [p.x, tx],
                cy: [p.y, ty],
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 1.8 + i * 0.4,
                ease: "easeInOut",
                times: [0, 0.15, 0.85, 1],
              }}
            />
          );
        })}

        {/* Central pot */}
        <motion.g
          style={{ transformOrigin: `${center}px ${center}px` }}
          animate={{ scale: completed ? 0.94 : [1, 1.018, 1] }}
          transition={
            completed
              ? { duration: 0.4 }
              : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* Outer glow (only when not completed) */}
          {!completed && (
            <motion.circle
              cx={center}
              cy={center}
              r={86}
              fill={cycleActive ? "rgba(252, 211, 77, 0.18)" : "rgba(252, 211, 77, 0.1)"}
              filter="url(#softGlow)"
              animate={{ opacity: [0.45, 0.85, 0.45] }}
              transition={{ duration: cycleActive ? 2.4 : 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Main pot body */}
          <circle cx={center} cy={center} r={70} fill={completed ? "url(#potDim)" : "url(#potGold)"} />
          <circle cx={center} cy={center} r={70} fill="url(#potShine)" />

          {/* Inner rim line — small visual depth */}
          <circle
            cx={center}
            cy={center}
            r={62}
            fill="none"
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={1}
          />

          {/* Locked ring when cycle is ACTIVE */}
          {cycleActive && !completed && (
            <>
              <motion.circle
                cx={center}
                cy={center}
                r={78}
                fill="none"
                stroke="#FCD34D"
                strokeWidth={1.5}
                strokeDasharray="2 6"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: 0.85,
                  rotate: 360,
                }}
                transition={{
                  pathLength: { duration: 0.9, ease: "easeOut" },
                  opacity: { duration: 0.4 },
                  rotate: { duration: 18, repeat: Infinity, ease: "linear" },
                }}
                style={{ transformOrigin: `${center}px ${center}px` }}
              />
              <motion.circle
                cx={center}
                cy={center}
                r={92}
                fill="none"
                stroke="oklch(0.86 0.18 90 / 0.3)"
                strokeWidth={1}
                strokeDasharray="1 9"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1, rotate: -360 }}
                transition={{
                  rotate: { duration: 30, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.6 },
                  opacity: { duration: 0.4 },
                }}
                style={{ transformOrigin: `${center}px ${center}px` }}
              />
            </>
          )}

          {/* Pot text */}
          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={28}
            fontWeight={800}
            fill={completed ? "oklch(0.708 0 0)" : "#0c0a09"}
            style={{ letterSpacing: "-0.02em" }}
          >
            {formatUnits(potValue, 18, 2)}
          </text>
          <text
            x={center}
            y={center + 19}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={10}
            fontWeight={700}
            fill={completed ? "oklch(0.488 0 0)" : "#0c0a09"}
            opacity={0.72}
            letterSpacing="0.16em"
          >
            POT · mcUSD
          </text>
        </motion.g>

        {/* Member nodes */}
        {members.map((addr, i) => {
          const p = positions[i];
          const isPayee = i === payeeIdx;
          const hasContributed = contributedFlags[i];
          return (
            <g key={addr}>
              {/* Active-payee pulse aura */}
              {isPayee && !completed && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={nodeRadius + 14}
                  fill="none"
                  stroke="#FCD34D"
                  strokeWidth={1.5}
                  animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0.08, 0.7] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
              )}

              {/* Contributed (non-payee) confirmation ring */}
              {hasContributed && !isPayee && !completed && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={nodeRadius + 6}
                  fill="none"
                  stroke="oklch(0.78 0.18 152 / 0.55)"
                  strokeWidth={1.5}
                  initial={{ scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              )}

              {/* Soft node shadow underneath */}
              <circle
                cx={p.x}
                cy={p.y + 4}
                r={nodeRadius}
                fill="rgba(0,0,0,0.35)"
                filter="url(#softGlow)"
                opacity={isPayee ? 0.8 : 0.4}
              />

              {/* Node body */}
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={nodeRadius}
                fill={
                  isPayee
                    ? "url(#nodePayee)"
                    : hasContributed
                      ? "url(#nodeContrib)"
                      : "url(#nodePending)"
                }
                stroke={
                  isPayee
                    ? "transparent"
                    : hasContributed
                      ? "oklch(0.78 0.18 152 / 0.7)"
                      : "oklch(0.371 0 0)"
                }
                strokeWidth={1.5}
                animate={{ scale: isPayee ? 1.08 : 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />

              {/* Highlight crescent on top of node for depth */}
              <circle
                cx={p.x}
                cy={p.y - nodeRadius * 0.35}
                r={nodeRadius * 0.7}
                fill="rgba(255,255,255,0.06)"
                pointerEvents="none"
              />

              {/* Member index */}
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontSize={16}
                fontWeight={700}
                fill={isPayee ? "#0c0a09" : "oklch(0.985 0 0)"}
              >
                {i + 1}
              </text>

              {/* Address label */}
              <text
                x={p.x}
                y={p.y + nodeRadius + 19}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill={isPayee ? "oklch(0.86 0.18 90)" : "oklch(0.65 0 0)"}
              >
                {`${addr.slice(0, 5)}…${addr.slice(-3)}`}
              </text>

              {/* Active payee crown (only when not completed) */}
              {isPayee && !completed && (
                <Crown cx={p.x} cy={p.y - nodeRadius - 6} />
              )}
            </g>
          );
        })}

        {/* Completion check */}
        {completed && (
          <motion.path
            d={`M ${center - 20} ${center} l 13 13 l 27 -27`}
            fill="none"
            stroke="oklch(0.78 0.18 152)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          />
        )}
      </svg>

      {/* Corner: cycle */}
      <div className="pointer-events-none absolute top-1 left-1 surface-tile px-3 py-1.5 text-xs space-y-0.5">
        <div>
          <span className="text-[var(--color-fg-subtle)] mr-2">CYCLE</span>
          <span className="nums">
            {completed ? "—" : currentCycle.toString()} / {totalN}
          </span>
        </div>
        {roundsN > 1 && !completed && (
          <div className="text-[10px] text-[var(--color-fg-subtle)]">
            round {Math.min(roundIdx + 1, roundsN)} / {roundsN}
          </div>
        )}
      </div>

      {/* Corner: contribution amount */}
      {!completed && (
        <div className="pointer-events-none absolute top-1 right-1 surface-tile px-3 py-1.5 text-xs nums">
          <span className="text-[var(--color-fg-subtle)] mr-2">CONTRIB</span>
          {formatUnits(contribution)} mcUSD
        </div>
      )}

      {/* Bottom: live phase status */}
      {!completed && (
        <motion.div
          key={cycleActive ? "active" : "open"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={
            cycleActive
              ? "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full border border-[oklch(0.78_0.18_230/0.4)] bg-[oklch(0.78_0.18_230/0.08)] text-[oklch(0.78_0.18_230)] backdrop-blur-sm flex items-center gap-2"
              : "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full border border-[var(--color-border)] bg-black/40 text-[var(--color-fg-muted)] backdrop-blur-sm flex items-center gap-2"
          }
        >
          {cycleActive ? (
            <>
              <motion.span
                className="size-1.5 rounded-full bg-[oklch(0.78_0.18_230)]"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              cycle active · waiting for timer
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-[var(--color-fg-subtle)]" />
              {paidCount}/{members.length} paid in · collecting
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Tiny crown SVG that bobs gently above the active payee node.
 */
function Crown({ cx, cy }: { cx: number; cy: number }) {
  return (
    <motion.g
      animate={{ y: [-2, 1, -2] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d={`M ${cx - 11} ${cy + 4}
            L ${cx - 9} ${cy - 6}
            L ${cx - 4} ${cy - 1}
            L ${cx} ${cy - 9}
            L ${cx + 4} ${cy - 1}
            L ${cx + 9} ${cy - 6}
            L ${cx + 11} ${cy + 4}
            Z`}
        fill="#FCD34D"
        stroke="#78350F"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <circle cx={cx - 9} cy={cy - 6.4} r={1.4} fill="#FEF3C7" />
      <circle cx={cx} cy={cy - 9.4} r={1.6} fill="#FEF3C7" />
      <circle cx={cx + 9} cy={cy - 6.4} r={1.4} fill="#FEF3C7" />
      <rect
        x={cx - 11}
        y={cy + 3}
        width={22}
        height={2}
        rx={1}
        fill="#92400E"
        opacity={0.85}
      />
    </motion.g>
  );
}
