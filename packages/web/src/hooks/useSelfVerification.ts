import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SELF_VERIFIED_EVENT, getStoredVerification, setStoredVerification } from "@/lib/self";

export function useSelfVerification() {
  const { address } = useAccount();
  const [verified, setVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<number | undefined>();

  const refresh = useCallback(() => {
    const s = getStoredVerification(address);
    setVerified(s.verified);
    setVerifiedAt(s.at);
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sync across all hook consumers in the same tab when any one of them
  // marks a verification. Also picks up cross-tab changes via 'storage'.
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail?.address as string | undefined;
      if (!target || (address && target === address.toLowerCase())) refresh();
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key?.startsWith("chamaagent:self-verified:")) refresh();
    };
    window.addEventListener(SELF_VERIFIED_EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(SELF_VERIFIED_EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [address, refresh]);

  const markVerified = () => {
    if (!address) return;
    setStoredVerification(address); // dispatches the event; refresh() runs in the listener
  };

  return { address, verified, verifiedAt, markVerified };
}
