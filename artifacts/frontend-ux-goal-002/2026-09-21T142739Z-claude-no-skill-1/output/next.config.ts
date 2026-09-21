import type { NextConfig } from 'next'

// @coinbase/cdp-sdk (pulled in by wagmi's Base Account connector) lazily imports
// optional x402 payment packages that this app never uses. Stub them so the bundler
// doesn't fail resolving them.
const optionalDeps = [
  '@x402/core/client',
  '@x402/evm',
  '@x402/evm/exact/client',
  '@x402/evm/upto/client',
  '@x402/svm/exact/client',
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: Object.fromEntries(optionalDeps.map((m) => [m, './empty-module.js'])),
  },
}

export default nextConfig
