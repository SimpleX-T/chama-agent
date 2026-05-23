/**
 * Self Protocol configuration.
 *
 * Identity Verification Hub (Self's contracts):
 *  - Celo Sepolia: 0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74
 *  - Celo mainnet: 0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF
 *
 * Our `ChamaVerifier` contract extends @selfxyz/contracts SelfVerificationRoot
 * and registers a verification config (proof-of-humanity + OFAC) with the hub.
 * The frontend points the QR `endpoint` at our verifier, not the hub. Self's
 * hub routes the proof to our contract via the Poseidon-hashed scope.
 *
 * Disclosures here MUST match the on-chain config:
 *   olderThan: 0, forbiddenCountries: [], ofacEnabled: true
 */

import deployment from "../../../contracts/deployments/11142220.json";

export const SELF_HUB_SEPOLIA = "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74";
export const SELF_HUB_MAINNET = "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF";

export const CHAMA_VERIFIER_ADDR =
  ((deployment as any).contracts?.ChamaVerifier as `0x${string}` | undefined) ?? null;
export const SELF_SCOPE_SEED =
  ((deployment as any).self?.scopeSeed as string | undefined) ?? "chamaagent";

export const SELF_APP_CONFIG = {
  appName: "ChamaAgent",
  scope: SELF_SCOPE_SEED,
  logoBase64: "https://raw.githubusercontent.com/SimpleX-T/chama-agent/main/packages/contracts/icon.svg",
};

const STORAGE_PREFIX = "chamaagent:self-verified:";
export const SELF_VERIFIED_EVENT = "chamaagent:self-verified";

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
  // Custom event — same-tab localStorage writes don't trigger 'storage' events,
  // so we dispatch this to sync every useSelfVerification consumer.
  window.dispatchEvent(
    new CustomEvent(SELF_VERIFIED_EVENT, { detail: { address: address.toLowerCase() } }),
  );
}

export function clearStoredVerification(address: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_PREFIX + address.toLowerCase());
  window.dispatchEvent(
    new CustomEvent(SELF_VERIFIED_EVENT, { detail: { address: address.toLowerCase() } }),
  );
}
