import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getStoredVerification, setStoredVerification } from "@/lib/self";

export function useSelfVerification() {
  const { address } = useAccount();
  const [verified, setVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<number | undefined>();

  useEffect(() => {
    const s = getStoredVerification(address);
    setVerified(s.verified);
    setVerifiedAt(s.at);
  }, [address]);

  const markVerified = () => {
    if (!address) return;
    setStoredVerification(address);
    setVerified(true);
    setVerifiedAt(Date.now());
  };

  return { address, verified, verifiedAt, markVerified };
}
