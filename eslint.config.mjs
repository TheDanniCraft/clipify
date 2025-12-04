import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  // Next.js + React + React Hooks + Core Web Vitals
  ...nextVitals,

  // Extra TypeScript rules from eslint-config-next
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    "node_modules/**",
  ]),
]);
