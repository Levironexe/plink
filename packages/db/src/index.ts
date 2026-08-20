import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

export * from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy apps/web/.env.example to .env.local and point it at your Postgres database.",
    );
  }
  return url;
}

function createClient() {
  // Point DATABASE_URL at Neon's pooled endpoint (the host ending in `-pooler`)
  // so serverless invocations share connections instead of exhausting them.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
}

function client(): PrismaClient {
  // Cached in every environment: the proxy below calls this on each property
  // access, so anything less would open a fresh connection pool per query.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Connects on first use rather than at import. `next build` imports every route
 * to collect page data, and a build machine has no database — constructing the
 * client eagerly would fail the build before a single query is ever made.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
  has(_target, property) {
    return Reflect.has(client(), property);
  },
});
