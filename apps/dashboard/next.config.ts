import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sessionforge/db"],
  serverExternalPackages: ["ssh2"],
};

export default nextConfig;
