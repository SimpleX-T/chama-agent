import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, CheckCircle2, RotateCw, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import { CHAMA_VERIFIER_ADDR, SELF_APP_CONFIG, SELF_HUB_SEPOLIA } from "@/lib/self";
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
type SelfErrorState = {
  status: string;
  reason?: string;
  errorCode?: string;
};

const errorCopy: Record<string, { title: string; body: string }> = {
  proof_generation_failed: {
    title: "Proof generation failed",
    body:
      "Self attempted to submit your proof to the on-chain verifier and the transaction reverted. On Celo Sepolia we currently point the QR at Self's IdentityVerificationHub directly, which only accepts proofs against scopes registered to a consumer contract. Deploying our ChamaVerifier (next milestone) will resolve this.",
  },
  user_canceled: {
    title: "Verification cancelled",
    body: "You closed the Self app before generating the proof. Try again whenever you're ready.",
  },
  mobile_disconnected: {
    title: "Phone disconnected",
    body: "The Self app lost connection to the browser. Hit retry to start a fresh session.",
  },
  network_error: {
    title: "Network error",
    body: "Couldn't reach Self's relay. Check your connection and try again.",
  },
};

function humanizeError(err: SelfErrorState): { title: string; body: string } {
  const known = errorCopy[err.status];
  if (known) return known;
  return {
    title: `Verification failed (${err.status || "unknown"})`,
    body: err.reason || "Self didn't send a reason. Try again, or check the browser console for the full payload.",
  };
}

export function SelfVerificationCard({ className, onVerified, title }: Props) {
  const { address, isConnected } = useAccount();
  const { verified, markVerified } = useSelfVerification();
  const [scanning, setScanning] = useState(false);
  const [selfApp, setSelfApp] = useState<any>(null);
  const [error, setError] = useState<SelfErrorState | null>(null);

  useEffect(() => {
    if (!isConnected || !address || !scanning) {
      setSelfApp(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { SelfAppBuilder } = await import("@selfxyz/qrcode");
      // endpoint = OUR ChamaVerifier (consumer of Self's hub).
      // Falls back to the hub itself if the verifier isn't deployed for this
      // chain — proofs will fail in that case, but the SDK still renders.
      const endpoint = CHAMA_VERIFIER_ADDR ?? SELF_HUB_SEPOLIA;
      const app = new SelfAppBuilder({
        version: 2,
        appName: SELF_APP_CONFIG.appName,
        scope: SELF_APP_CONFIG.scope,
        endpoint,
        logoBase64: SELF_APP_CONFIG.logoBase64,
        userId: address,
        endpointType: "staging_celo",
        userIdType: "hex",
        // Must mirror ChamaVerifier's registered config exactly:
        //   olderThan: 0, forbiddenCountries: [], ofacEnabled: true
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

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-xl border border-[oklch(0.7_0.22_25/0.35)] bg-[oklch(0.7_0.22_25/0.06)] p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-[oklch(0.7_0.22_25)] mt-0.5 shrink-0" />
              <div className="text-sm flex-1 min-w-0">
                <div className="font-semibold text-[oklch(0.85_0.18_25)]">
                  {humanizeError(error).title}
                </div>
                <p className="mt-1.5 text-[var(--color-fg-muted)] text-pretty leading-relaxed">
                  {humanizeError(error).body}
                </p>
                {error.reason && error.reason !== humanizeError(error).body && (
                  <div className="mt-2 text-xs font-mono text-[var(--color-fg-subtle)] break-all">
                    Self relay: {error.reason}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setScanning(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] text-[#09090b] px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition"
                  >
                    <RotateCw className="size-3.5" />
                    Try again
                  </button>
                  <a
                    href="https://github.com/SimpleX-T/chama-agent#self-id"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Why is this failing? →
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!error && scanning && selfApp && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 grid place-items-center"
          >
            <Suspense fallback={<QRPlaceholder />}>
              <SelfQRcodeWrapper
                selfApp={selfApp}
                onSuccess={() => {
                  markVerified();
                  setScanning(false);
                  onVerified?.();
                }}
                onError={(err: any) => {
                  console.error("Self verification error", err);
                  setError({
                    status: err?.status ?? "unknown",
                    reason: err?.reason,
                    errorCode: err?.error_code,
                  });
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
          </motion.div>
        )}

        {!error && !scanning && (
          <motion.div
            key="cta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[#09090b] hover:brightness-110 transition"
            >
              <ShieldCheck className="size-4" />
              Start verification
            </button>
            <p className="mt-3 text-xs text-[var(--color-fg-subtle)] leading-relaxed">
              Staging mode (mock passports OK). Proofs are verified by our{" "}
              <a
                href={`https://celo-sepolia.blockscout.com/address/${CHAMA_VERIFIER_ADDR ?? ""}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors font-mono"
              >
                ChamaVerifier
              </a>{" "}
              contract — it extends Self's <span className="font-mono">SelfVerificationRoot</span>,
              records <span className="font-mono">verified[user]=true</span>, and is what the
              Chama escrow will gate membership on next.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
