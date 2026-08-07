import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true"
  },
  // The Base Account / Coinbase connector (pulled in transitively by RainbowKit +
  // wagmi) lazily imports optional @x402/* payment modules that aren't installed.
  // They are never executed for injected / MetaMask flows, so we ignore them to
  // stop the dev server and build from 500'ing on "Module not found".
  webpack: (config, { webpack }) => {
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