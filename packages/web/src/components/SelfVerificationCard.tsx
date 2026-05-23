import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import { SELF_APP_CONFIG, SELF_HUB_SEPOLIA } from "@/lib/self";
import { useSelfVerification } from "@/hooks/useSelfVerification";

// Lazy: keeps the Self SDK (~440KB gz) out of the main bundle until needed
const SelfQRcodeWrapper = lazy(async () => {
  const mod = await import("@selfxyz/qrcode");
  return { default: mod.SelfQRcodeWrapper };
});

type Props = {
  className?: string;
  /** Optional callback when verification succeeds (in addition to writing to localStorage). */
  onVerified?: () => void;
  /** Optional title override. */
  title?: string;
};

/**
 * Real Self Protocol QR verification panel.
 *
 *  - Connected wallet → renders the QR via @selfxyz/qrcode SelfQRcodeWrapper
 *  - User scans with Self mobile app → ZK passport proof → Self relays back
 *  - onSuccess marks the address as verified in localStorage (MVP); next
 *    milestone is an on-chain verifier contract that records verification
 *    in storage so Chama membership can be gated trustlessly.
 */
export function SelfVerificationCard({ className, onVerified, title }: Props) {
  const { address, isConnected } = useAccount();
  const { verified, markVerified } = useSelfVerification();
  const [scanning, setScanning] = useState(false);
  const [selfApp, setSelfApp] = useState<any>(null);

  useEffect(() => {
    if (!isConnected || !address || !scanning) {
      setSelfApp(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { SelfAppBuilder } = await import("@selfxyz/qrcode");
      const app = new SelfAppBuilder({
        version: 2,
        appName: SELF_APP_CONFIG.appName,
        scope: SELF_APP_CONFIG.scope,
        endpoint: SELF_HUB_SEPOLIA,
        logoBase64: SELF_APP_CONFIG.logoBase64,
        userId: address,
        endpointType: "staging_celo",
        userIdType: "hex",
        disclosures: {
          ofac: true,
        },
      }).build();
      if (!cancelled) setSelfApp(app);
    })().catch((e) => console.error("Self SDK init failed", e));
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, scanning]);

  if (!isConnected) {
    return (
      <Shell className={className} title={title ?? "Verify with Self"}>
        <div className="mt-4 flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
          <ShieldQuestion className="size-5 text-[var(--color-fg-subtle)]" />
          Connect a wallet to start the proof-of-humanity flow.
        </div>
        <div className="mt-4">
          <ConnectButton label="Connect wallet" showBalance={false} />
        </div>
      </Shell>
    );
  }

  if (verified) {
    return (
      <Shell className={className} title={title ?? "Identity verified"}>
        <div className="mt-3 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-[oklch(0.78_0.18_152)] mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-[var(--color-fg)]">
              Verified via Self.
            </div>
            <div className="mt-1 text-[var(--color-fg-muted)] text-pretty leading-relaxed">
              This wallet has proven uniqueness + humanity. ChamaAgent doesn't see your passport
              data — only the zero-knowledge proof was checked.
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell className={className} title={title ?? "Verify with Self"}>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)] text-pretty leading-relaxed">
        Scan with the{" "}
        <a
          href="https://self.xyz"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          Self app
        </a>{" "}
        on your phone. The app generates a zero-knowledge proof of humanity from your government
        ID — ChamaAgent never sees the document, only the proof.
      </p>

      {scanning && selfApp ? (
        <div className="mt-5 grid place-items-center">
          <Suspense fallback={<QRPlaceholder />}>
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                markVerified();
                onVerified?.();
              }}
              onError={(err: any) => {
                console.error("Self verification error", err);
                setScanning(false);
              }}
              size={260}
            />
          </Suspense>
          <button
            type="button"
            onClick={() => setScanning(false)}
            className="mt-3 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[#09090b] hover:brightness-110 transition"
          >
            <ShieldCheck className="size-4" />
            Start verification
          </button>
          <p className="mt-3 text-xs text-[var(--color-fg-subtle)] leading-relaxed">
            Staging mode (mock passports). On mainnet, real passport proofs flow through Self's
            on-chain verifier at <span className="font-mono">0xe57F…f5BF</span>.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  className,
  title,
  children,
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface p-6 sm:p-7", className)}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 place-items-center rounded-xl text-[var(--color-accent)] shrink-0"
          style={{ background: "var(--color-accent-soft)" }}
        >
          <ShieldCheck className="size-5" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function QRPlaceholder() {
  return (
    <div className="w-[260px] h-[260px] rounded-2xl bg-white/[0.04] border border-[var(--color-border)] animate-pulse" />
  );
}
