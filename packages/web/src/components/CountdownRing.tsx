import { useEffect, useState } from "react";

type Props = {
  deadline: bigint;
  total: bigint; // cycle length in seconds (for the ring fill ratio)
  size?: number;
};

export function CountdownRing({ deadline, total, size = 64 }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const remain = Math.max(0, Number(deadline) - now);
  const totalNum = Number(total);
  const pct = totalNum > 0 ? Math.max(0, Math.min(1, remain / totalNum)) : 0;
  const expired = remain <= 0;

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  const h = Math.floor(remain / 3600);
  const m = Math.floor((remain % 3600) / 60);
  const s = remain % 60;
  const label = expired ? "now" : h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.269 0 0)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={expired ? "oklch(0.7 0.22 25)" : "var(--color-accent)"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] leading-none">
          {expired ? "due" : "ends in"}
        </div>
        <div className="text-sm font-semibold nums leading-tight mt-0.5">{label}</div>
      </div>
    </div>
  );
}
