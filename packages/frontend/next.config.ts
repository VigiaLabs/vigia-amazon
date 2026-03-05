import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Prevent Next.js from bundling the AWS SDK — let Node.js require() it at runtime.
  // This is required for Amplify Hosting SSR (the Lambda has aws-sdk available via node_modules).
  serverExternalPackages: ['@aws-sdk/client-bedrock-agent-runtime'],

  // Amplify-specific: ensure AWS SDK is available at runtime
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-bedrock-agent-runtime'],
  },

  // Note: 'standalone' output is NOT used — Amplify Hosting manages the SSR runtime.
};

export default nextConfig;
