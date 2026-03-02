import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@sessionforge/db"],
  webpack: (config) => {
    // In the isolated worktree, node_modules/@sessionforge/db symlinks to the
    // parent project's packages/db which lacks the analytics schema additions.
    // Override resolution to use the worktree-local packages/db source instead.
    config.resolve.alias["@sessionforge/db"] = path.resolve(
      process.cwd(),
      "../../packages/db/src/index.ts"
    );
    return config;
  },
};

export default nextConfig;
