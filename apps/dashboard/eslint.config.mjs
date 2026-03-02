import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
    ignores: ["node_modules/**", ".next/**"],
  },
];
