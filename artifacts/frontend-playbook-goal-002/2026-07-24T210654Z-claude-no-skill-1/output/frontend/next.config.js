/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // wagmi/walletconnect pull in optional deps that need to be treated as external.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // The Coinbase/Base-account connector (transitively referenced by
    // @rainbow-me/rainbowkit -> wagmi/connectors) lazily imports optional x402
    // payment modules we never use and don't install. Ignore the whole
    // namespace so the bundle resolves; the dynamic import is never executed.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }),
    );
    // @metamask/sdk optionally references a React Native storage module that
    // isn't used in the browser build. Ignore it to keep dev output clean.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@react-native-async-storage\/async-storage$/,
      }),
    );
    return config;
  },
};

module.exports = nextConfig;
