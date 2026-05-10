import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  // Next.js + React + React Hooks + Core Web Vitals
  ...nextVitals,

  // Extra TypeScript rules from eslint-config-next
  ...nextTs,
  {
    files: ["src/app/components/**/*.ts", "src/app/components/**/*.tsx", "src/app/dashboard/**/*.ts", "src/app/dashboard/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: ["@/server/*"], message: "Do not import server internals into client-exposed modules." }],
        },
      ],
    },
  },
  {
    files: ["src/app/actions/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration[id.name=/.*Internal$/]",
          message: "Do not export internal helpers from action modules.",
        },
      ],
    },
  },

  {
    files: ["test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
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

