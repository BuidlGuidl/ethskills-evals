import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // WalletConnect's logger has optional node-only deps
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
};

export default nextConfig;
