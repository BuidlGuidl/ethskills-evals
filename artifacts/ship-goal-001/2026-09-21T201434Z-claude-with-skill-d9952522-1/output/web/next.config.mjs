/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler's way.
  serverExternalPackages: ["better-sqlite3"],

  webpack: (config, { webpack }) => {
    // The wagmi connectors barrel reaches Coinbase's CDP SDK, which imports the
    // optional `@x402/*` payment packages. Toolshed does not use x402, and
    // those packages are not installed, so ignore the whole namespace rather
    // than pulling in a payments SDK we never call.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

export default nextConfig;
