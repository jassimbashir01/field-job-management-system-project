import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    ".open-next/**",
    "node_modules/**",
    "drizzle/**",
    "cloudflare-env.d.ts",
    "next-env.d.ts",
  ]),

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/db/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);
