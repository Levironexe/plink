import { defineConfig } from "eslint/config";
import next from "@plink/eslint-config/next";

export default defineConfig([
  ...next,
  {
    // This package is a component library, not an app — it has no pages dir.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);
