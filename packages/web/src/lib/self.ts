/**
 * Self Protocol configuration.
 *
 * Identity Verification Hub addresses (Self's on-chain verifier):
 *  - Celo Sepolia (mock passports for dev): 0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74
 *  - Celo mainnet (real passports):         0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF
 *
 * MVP: we use the hub address as the verification endpoint so SelfQRcodeWrapper
 *      can complete the proof flow end-to-end. The wallet that scanned proves
 *      uniqueness + humanity through Self's ZK passport system; we record the
 *      result locally and let the UI gate creation actions.
 *
 * Stretch (next milestone): a thin `ChamaVerifiedRegistry.sol` contract that
 *      receives the verification callback from Self's hub and records
 *      `mapping(address => bool) verified` so on-chain Chama membership is
 *      gated by Self ID without trusting the client.
 */

export const SELF_HUB_SEPOLIA = "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74";
export const SELF_HUB_MAINNET = "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF";

export const SELF_APP_CONFIG = {
  appName: "ChamaAgent",
  scope: "chama-agent-celo",
  logoBase64: "https://raw.githubusercontent.com/SimpleX-T/chama-agent/main/packages/contracts/icon.svg",
};

const STORAGE_PREFIX = "chamaagent:self-verified:";

export function getStoredVerification(address: string | undefined): {
  verified: boolean;
  at?: number;
} {
  if (!address || typeof window === "undefined") return { verified: false };
  const raw = localStorage.getItem(STORAGE_PREFIX + address.toLowerCase());
  if (!raw) return { verified: false };
  try {
    const obj = JSON.parse(raw);
    return { verified: true, at: obj.at };
  } catch {
    return { verified: false };
  }
}

export function setStoredVerification(address: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_PREFIX + address.toLowerCase(),
    JSON.stringify({ at: Date.now() }),
  );
}

export function clearStoredVerification(address: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_PREFIX + address.toLowerCase());
}
