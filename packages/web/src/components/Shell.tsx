import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { MiniPayBanner } from "@/components/MiniPayBanner";
import { NetworkBadge } from "@/components/NetworkBadge";
import { useMiniPay } from "@/hooks/useMiniPay";

const nav = [
  { to: "/", label: "Overview" },
  { to: "/chama/featured", label: "Live chama" },
  { to: "/create", label: "Create" },
];

export function Shell() {
  const loc = useLocation();
  // Mount the hook to fire MiniPay auto-connect on first render
  useMiniPay();
  return (
    <div className="flex min-h-dvh flex-col">
      <MiniPayBanner />
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)]/60 bg-[var(--color-bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo className="size-7 transition-transform group-hover:rotate-[120deg] duration-500" />
            <span className="font-semibold tracking-tight">
              Chama<span className="text-[var(--color-accent)]">Agent</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((n) => {
              const isActive =
                n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to.split(":")[0]);
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md transition-colors",
                    isActive ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{n.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <NetworkBadge />
            </div>
            <ConnectButton
              chainStatus={{ smallScreen: "icon", largeScreen: "icon" }}
              accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
              showBalance={false}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)]/60 mt-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Logo className="size-5" />
              <span className="font-semibold">ChamaAgent</span>
            </div>
            <p className="text-[var(--color-fg-muted)] max-w-xs leading-relaxed">
              Trustless rotating savings on Celo. ERC-8004 agent operating per-group cUSD escrow contracts.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-[var(--color-fg-subtle)] uppercase tracking-wider text-xs mb-3">Resources</div>
            <FooterLink href="https://github.com/SimpleX-T/chama-agent">GitHub</FooterLink>
            <FooterLink href="https://8004scan.io/agents/celo-sepolia/274">8004scan · Agent #274</FooterLink>
            <FooterLink href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004 spec</FooterLink>
            <FooterLink href="https://docs.celo.org">Celo docs</FooterLink>
          </div>
          <div className="space-y-2">
            <div className="text-[var(--color-fg-subtle)] uppercase tracking-wider text-xs mb-3">Built for</div>
            <FooterLink href="https://www.celopg.eco/programs/proof-of-ship">Celo Proof of Ship — May 2026</FooterLink>
            <FooterLink href="https://www.celopg.eco/insights/build-your-agent-on-celo">Onchain Agents Hackathon</FooterLink>
          </div>
        </div>
        <div className="border-t border-[var(--color-border)]/60">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-5 text-xs text-[var(--color-fg-subtle)] flex flex-wrap items-center justify-between gap-2">
            <span>MIT · 2026</span>
            <span className="font-mono">Celo Sepolia · chain 11142220</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
    >
      {children}
    </a>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden>
      <rect width="400" height="400" rx="80" fill="#09090b" />
      <circle cx="200" cy="110" r="38" fill="#FCD34D" />
      <circle cx="116" cy="256" r="38" fill="#FCD34D" />
      <circle cx="284" cy="256" r="38" fill="#FCD34D" />
      <path d="M 232 132 Q 290 200 270 230" stroke="#FCD34D" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 130 230 Q 110 200 168 132" stroke="#FCD34D" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 240 264 L 160 264" stroke="#FCD34D" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
