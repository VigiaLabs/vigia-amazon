import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Note: 'standalone' output is NOT used — Amplify Hosting manages the SSR runtime
};

export default nextConfig;
