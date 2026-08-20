import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/** Shared rules for every package in the monorepo. */
export default defineConfig([
  ...tseslint.configs.recommended,
  globalIgnores(["dist/**", "node_modules/**", "generated/**"]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
