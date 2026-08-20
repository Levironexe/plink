import { defineConfig, globalIgnores } from "eslint/config";
import base from "@plink/eslint-config/base";

export default defineConfig([
  ...base,
  // Prisma Client is code-generated; linting it is noise.
  globalIgnores(["generated/**", "dist/**"]),
]);
