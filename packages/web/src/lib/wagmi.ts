import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import { celoSepolia, RPC_URLS } from "./chain";

// WalletConnect project ID — get yours free at https://cloud.reown.com/
// Falls back to a placeholder so injected wallets (MetaMask / MiniPay) still work.
const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID ?? "chama-agent-placeholder";

export const wagmiConfig = getDefaultConfig({
  appName: "ChamaAgent",
  appDescription: "Trustless rotating savings on Celo",
  appUrl: "https://github.com/SimpleX-T/chama-agent",
  appIcon: "https://raw.githubusercontent.com/SimpleX-T/chama-agent/main/packages/contracts/icon.svg",
  projectId: wcProjectId,
  chains: [celoSepolia],
  transports: {
    [celoSepolia.id]: fallback(
      RPC_URLS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })),
      { rank: false },
    ),
  },
  ssr: false,
});
