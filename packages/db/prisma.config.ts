import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` runs on every install, including CI and Vercel builds where
 * no database exists. Reading DATABASE_URL through Prisma's `env()` helper makes
 * the config throw when it is absent, which fails the build before it starts —
 * so resolve it ourselves and leave it undefined when unset. Commands that
 * genuinely need a connection (migrate, studio, seed) still fail loudly.
 */
const url = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});
