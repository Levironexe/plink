import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/index.js";

export * from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * SQLite lives inside this package, so the URL has to be resolved from the
 * package root rather than the caller's cwd — otherwise every workspace that
 * imports the client would look for the file next to its own package.json.
 */
function databaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (configured && !configured.startsWith("file:.")) return configured;

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const relative = configured ? configured.slice("file:".length) : "./dev.db";
  return `file:${path.resolve(packageRoot, relative)}`;
}

function createClient() {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
