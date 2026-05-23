import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";

import "./styles/globals.css";

import { wagmiConfig } from "@/lib/wagmi";
import { Shell } from "@/components/Shell";
import { Landing } from "@/routes/Landing";
import { ChamaDetail } from "@/routes/ChamaDetail";
import { Create } from "@/routes/Create";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 8_000,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/chama/:address", element: <ChamaDetail /> },
      { path: "/create", element: <Create /> },
    ],
  },
]);

const rk = darkTheme({
  accentColor: "#FCD34D",
  accentColorForeground: "#09090b",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rk} appInfo={{ appName: "ChamaAgent" }}>
          <RouterProvider router={router} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
