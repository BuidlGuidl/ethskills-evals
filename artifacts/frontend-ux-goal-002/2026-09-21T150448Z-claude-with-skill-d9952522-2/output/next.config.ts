import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // WalletConnect pulls in optional node-only deps that must not be bundled.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  turbopack: {
    resolveAlias: {
      // The node entry of @base-org/account (RainbowKit's Base wallet) drags in the
      // server-side Coinbase CDP SDK and its uninstalled optional x402 deps. The wallet
      // only ever runs in the browser, so SSR uses the browser entry too.
      "@base-org/account": "@base-org/account/browser",
    },
  },
};

export default nextConfig;
