/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Base Account SDK's Node entry pulls in optional server-only deps (@x402/*); never needed during SSR.
  serverExternalPackages: ['@base-org/account', '@coinbase/cdp-sdk'],
  webpack: (config) => {
    // Optional deps pulled in by WalletConnect / MetaMask SDK that are not needed in the browser.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.fallback = { ...config.resolve.fallback, '@react-native-async-storage/async-storage': false };
    return config;
  },
};

export default nextConfig;
