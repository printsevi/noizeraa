import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker runner stage (apps/web/Dockerfile), which
  // copies .next/standalone rather than shipping node_modules.
  output: "standalone",
};

export default nextConfig;
