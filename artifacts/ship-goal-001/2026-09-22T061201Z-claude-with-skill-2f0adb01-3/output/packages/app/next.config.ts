import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tool photos come from IPFS gateways and arbitrary member-supplied URLs, so they are
  // rendered with plain <img> rather than next/image's allowlisted loader.
  images: { unoptimized: true },
};

export default nextConfig;
