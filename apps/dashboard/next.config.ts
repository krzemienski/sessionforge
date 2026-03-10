import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sessionforge/db"],
  serverExternalPackages: ["ssh2"],
};

export default nextConfig;
