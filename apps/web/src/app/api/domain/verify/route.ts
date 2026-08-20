import { resolveTxt } from "node:dns/promises";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  domainRecords,
  newDomainToken,
  normalizeDomain,
  verifyDomainTxt,
} from "@plink/core/domains";

type DomainRow = {
  customDomain: string | null;
  domainVerifiedAt: Date | null;
  domainToken: string | null;
};

function state(row: DomainRow) {
  return {
    domain: row.customDomain,
    verified: Boolean(row.domainVerifiedAt),
    verifiedAt: row.domainVerifiedAt?.toISOString() ?? null,
    records:
      row.customDomain && row.domainToken ? domainRecords(row.customDomain, row.domainToken) : [],
  };
}

/** GET — the current connection state, including the records still to add. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { customDomain: true, domainVerifiedAt: true, domainToken: true },
  });
  if (!row) return fail("Account not found", 404);

  return ok(state(row));
}

const domainSchema = z.object({ domain: z.string().min(1).max(255) });

/**
 * PUT — attach (or replace) the domain to connect. Minting a fresh token on
 * every change means an old TXT record can never verify a new domain.
 */
export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const parsed = domainSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter a domain", 422);

  const check = normalizeDomain(parsed.data.domain);
  if (!check.ok) return fail(check.error, 422);

  const taken = await prisma.user.findFirst({
    where: { customDomain: check.domain, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return fail("That domain is already connected to another page", 409);

  const row = await prisma.user.update({
    where: { id: userId },
    data: {
      customDomain: check.domain,
      domainToken: newDomainToken(),
      domainVerifiedAt: null,
    },
    select: { customDomain: true, domainVerifiedAt: true, domainToken: true },
  });

  return ok(state(row));
}

/**
 * POST — check DNS now. We only look for the TXT proof: the CNAME/A record is
 * what routes traffic, and asking for both would fail while DNS is still
 * propagating even though ownership is already provable.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const limit = rateLimit(clientKey(req, "domain-verify"), 12, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { customDomain: true, domainVerifiedAt: true, domainToken: true },
  });
  if (!row) return fail("Account not found", 404);
  if (!row.customDomain) return fail("Add a domain first", 400);

  // A row can predate the token column; mint one rather than dead-ending.
  let token = row.domainToken;
  if (!token) {
    token = newDomainToken();
    await prisma.user.update({ where: { id: userId }, data: { domainToken: token } });
  }

  const result = await verifyDomainTxt(row.customDomain, token, resolveTxt);
  const records = domainRecords(row.customDomain, token);

  if (!result.verified) {
    return fail(result.error ?? "Could not verify that domain yet", 409, {
      domain: row.customDomain,
      verified: false,
      hostname: result.hostname,
      expected: result.expected,
      found: result.found,
      records,
    });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { domainVerifiedAt: new Date() },
    select: { customDomain: true, domainVerifiedAt: true, domainToken: true },
  });

  return ok({ ...state(updated), hostname: result.hostname });
}

/** DELETE — disconnect the domain and forget the proof. */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const row = await prisma.user.update({
    where: { id: userId },
    data: { customDomain: null, domainToken: null, domainVerifiedAt: null },
    select: { customDomain: true, domainVerifiedAt: true, domainToken: true },
  });

  return ok(state(row));
}
