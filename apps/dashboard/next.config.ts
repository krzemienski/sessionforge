import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sessionforge/db"],
  serverExternalPackages: ["ssh2", "sharp", "simple-git", "ioredis"],
};

export default nextConfig;
