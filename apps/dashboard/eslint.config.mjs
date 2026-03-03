import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextPlugin = require("@next/eslint-plugin-next");

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
