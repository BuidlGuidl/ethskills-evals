/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; it must stay a real require at runtime.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
