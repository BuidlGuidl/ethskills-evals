import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  // RainbowKit -> wagmi -> @base-org/account -> @coinbase/cdp-sdk lazily
  // import()s optional `@x402/*` payment modules that this app never installs.
  // The bundler tries to resolve them statically and fails, so we ignore them
  // (they are never executed for the injected / MetaMask / burner flows we use).
  webpack: (config: any, { webpack }: any) => {
    config.plugins = config.plugins || [];
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@react-native-async-storage\/async-storage$/ }));
    config.externals = [...(config.externals || []), "pino-pretty", "lokijs", "encoding"];
    return config;
  },
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
