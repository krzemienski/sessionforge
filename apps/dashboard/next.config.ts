import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@sessionforge/db"],
  webpack: (config) => {
    // Fix broken symlinks in the bun worktree: react-syntax-highlighter's CJS
    // files require @babel/runtime helpers, but webpack can't find them via
    // the normal node_modules walk when the package lives in the bun cache.
    // Explicitly alias @babel/runtime to the copy linked in local node_modules.
    config.resolve = {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias ?? {}),
        // Packages that react-syntax-highlighter and prismjs need
        "@babel/runtime": path.resolve(__dirname, "node_modules/@babel/runtime"),
        "refractor": path.resolve(__dirname, "node_modules/refractor"),
        "prismjs": path.resolve(__dirname, "node_modules/prismjs"),
        "highlight.js": path.resolve(__dirname, "node_modules/highlight.js"),
        "lowlight": path.resolve(__dirname, "node_modules/lowlight"),
        "hastscript": path.resolve(__dirname, "node_modules/hastscript"),
        "parse-entities": path.resolve(__dirname, "node_modules/parse-entities"),
        // drizzle-orm alias ensures packages/db imports resolve consistently
        // regardless of which route file triggers webpack to process @sessionforge/db
        "drizzle-orm": path.resolve(__dirname, "node_modules/drizzle-orm"),
      },
    };
    return config;
  },
};

export default nextConfig;
