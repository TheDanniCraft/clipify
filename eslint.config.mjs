import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  // Next.js + React + React Hooks + Core Web Vitals
  ...nextVitals,

  // Extra TypeScript rules from eslint-config-next
  ...nextTs,

  {
    files: ["test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",

    "node_modules/**",
  ]),
]);
