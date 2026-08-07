import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true"
  },
  // RainbowKit -> wagmi/connectors -> @base-org/account -> @coinbase/cdp-sdk
  // lazily import()s optional @x402/* payment modules that aren't installed,
  // which otherwise 500s dev and fails the build. We never use those paths
  // (injected / MetaMask flows), so ignore them. NOTE: Turbopack ignores this
  // webpack config, so `dev`/`start` run with `next dev --webpack` (see package.json).
  webpack: (config: any, { webpack }: { webpack: any }) => {
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@react-native-async-storage\/async-storage$/ }),
    );
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  }
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}



module.exports = nextConfig;