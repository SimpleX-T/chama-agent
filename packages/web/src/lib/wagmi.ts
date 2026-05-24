import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import {
  celoMainnet,
  celoSepolia,
  MAINNET_RPC_URLS,
  SEPOLIA_RPC_URLS,
} from "./chain";

// WalletConnect project ID — get yours free at https://cloud.reown.com/
// Falls back to a placeholder so injected wallets (MetaMask / MiniPay) still work.
const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID ?? "chama-agent-placeholder";

export const wagmiConfig = getDefaultConfig({
  appName: "ChamaAgent",
  appDescription: "Trustless rotating savings on Celo",
  appUrl: "https://github.com/SimpleX-T/chama-agent",
  appIcon: "https://raw.githubusercontent.com/SimpleX-T/chama-agent/main/packages/contracts/icon.svg",
  projectId: wcProjectId,
  // Mainnet listed first → wagmi defaults to it when the wallet first connects.
  chains: [celoMainnet, celoSepolia],
  transports: {
    [celoMainnet.id]: fallback(
      MAINNET_RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
      { rank: false },
    ),
    [celoSepolia.id]: fallback(
      SEPOLIA_RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
      { rank: false },
    ),
  },
  ssr: false,
});
