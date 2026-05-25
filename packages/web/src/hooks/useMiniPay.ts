import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

/**
 * MiniPay detection + auto-connect.
 *
 * MiniPay (Opera's wallet, ~15M+ Celo users) injects `window.ethereum`
 * with `isMiniPay === true`. When detected, the wallet expects:
 *   - No connect-button modal — go straight to eth_requestAccounts
 *   - cUSD as feeCurrency (MiniPay users typically don't hold CELO)
 *   - A streamlined mobile-first flow
 *
 * Implementation notes that bit me on the first pass:
 *
 *  1. window.ethereum can inject *after* the React tree first paints
 *     (especially inside MiniPay's WebView). The original implementation
 *     read it once on mount and gave up — meaning the banner showed but
 *     auto-connect never fired. Now we poll for up to 6s before giving up.
 *
 *  2. Looking up the wagmi connector by id === "injected" missed it on
 *     setups where RainbowKit's getDefaultConfig labels the injected
 *     connector by vendor (e.g. "io.metamask", "com.opera.wallet"). The
 *     connector's `type` is always "injected" though, so we match on
 *     type first.
 *
 *  3. If wagmi connect() rejects, fall back to a direct
 *     window.ethereum.request({ method: "eth_requestAccounts" }) so the
 *     wallet UI at least opens its native account picker.
 */
export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [connectAttempted, setConnectAttempted] = useState(false);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Detection — retry up to 6s in case window.ethereum injects late
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let attempts = 0;
    const check = () => {
      if (cancelled) return;
      const eth = (window as any).ethereum;
      if (eth && eth.isMiniPay === true) {
        setIsMiniPay(true);
        return;
      }
      if (attempts++ < 30) {
        setTimeout(check, 200);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-connect once detected (and once connectors are ready)
  useEffect(() => {
    if (!isMiniPay || isConnected || connectAttempted || connectors.length === 0) return;
    setConnectAttempted(true);

    // Prefer the injected-type connector regardless of vendor name
    const injected =
      connectors.find((c) => (c as any).type === "injected") ??
      connectors.find((c) => c.id === "injected") ??
      connectors[0];

    if (injected) {
      try {
        connect({ connector: injected });
        return;
      } catch {
        /* fall through */
      }
    }
    // Last-resort fallback — direct provider request
    const eth = (window as any).ethereum;
    if (eth?.request) {
      eth.request({ method: "eth_requestAccounts" }).catch(() => {});
    }
  }, [isMiniPay, isConnected, connectAttempted, connect, connectors]);

  return isMiniPay;
}
