import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@sessionforge/db",
    "react-markdown",
    "remark-gfm",
    "rehype-highlight",
  ],
};

export default nextConfig;
