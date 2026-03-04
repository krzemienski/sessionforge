import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["@neondatabase/serverless"],
  transpilePackages: [
    "@sessionforge/db",
    "react-markdown",
    "remark-gfm",
    "rehype-highlight",
  ],
};

export default nextConfig;
