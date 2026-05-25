import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

/**
 * MiniPay detection + auto-connect.
 *
 * MiniPay (Opera's wallet for 15M+ Celo users) injects `window.ethereum`
 * with `isMiniPay === true`. When detected, the wallet expects:
 *   - No connect-button modal — call eth_requestAccounts directly
 *   - cUSD as feeCurrency (MiniPay users typically don't hold CELO)
 *   - A streamlined mobile-first flow (no wallet pickers)
 *
 * This hook returns the MiniPay flag and auto-fires `connect()` against
 * the injected connector on first detection so MiniPay users land
 * already-connected.
 */
export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (eth?.isMiniPay === true) {
      setIsMiniPay(true);
    }
  }, []);

  // Auto-connect once detected
  useEffect(() => {
    if (!isMiniPay || isConnected) return;
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) {
      try {
        connect({ connector: injected });
      } catch {
        /* MiniPay surfaces its own UX for failures */
      }
    }
  }, [isMiniPay, isConnected, connect, connectors]);

  return isMiniPay;
}
