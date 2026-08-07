/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // RainbowKit -> wagmi's Base/Coinbase account connector transitively imports
    // optional packages (pino-pretty, and unpublished @x402/* submodules used by
    // Base Pay) that we don't use in this local app. Ignore them so the build
    // doesn't fail trying to resolve modules that aren't installed.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp:
          /^(pino-pretty|lokijs|encoding)$|^@x402\/|^@react-native-async-storage\//,
      }),
    );
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
