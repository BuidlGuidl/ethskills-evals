import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pulled in by the Base Account connector during SSR; its optional x402 deps aren't installed.
  serverExternalPackages: ["@coinbase/cdp-sdk"],
};

export default nextConfig;
