import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sessionforge/db"],
};

export default nextConfig;
