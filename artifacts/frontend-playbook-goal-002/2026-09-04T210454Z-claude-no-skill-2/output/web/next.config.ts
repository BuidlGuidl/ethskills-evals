import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This project keeps its own README; no generated agent instruction files.
  agentRules: false,
  // Next 16 checks the dev-server origin; 127.0.0.1 is as common as localhost.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
}

export default nextConfig
