import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker runner stage (apps/web/Dockerfile), which
  // copies .next/standalone rather than shipping node_modules. Standalone
  // output symlinks into node_modules, which Windows refuses without
  // Developer Mode — the images and CI are Linux, so skip it there only.
  output: process.platform === "win32" ? undefined : "standalone",
};

export default nextConfig;
