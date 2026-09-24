import type {NextConfig} from "next";

/**
 * `wagmi/connectors` re-exports a Base Account connector we do not use, and its dependency chain
 * reaches Coinbase's CDP SDK, which lazily requires the `@x402/*` payment packages. Those are
 * optional peers — nothing installs them, and nothing in Toolshed calls the code path that needs
 * them — but webpack still tries to resolve the import and fails the build. Aliasing them to
 * `false` compiles them out.
 *
 * Revisit if Toolshed ever wants x402 payments, or when the connector stops pulling them in.
 */
const UNUSED_OPTIONAL_DEPS = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

const config: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],

  webpack(webpackConfig) {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      ...Object.fromEntries(UNUSED_OPTIONAL_DEPS.map((name) => [name, false])),
    };
    return webpackConfig;
  },
};

export default config;
