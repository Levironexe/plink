import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "plink_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secretKey() {
  const secret = process.env.AUTH_SECRET ?? "plink-insecure-development-secret-value";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = nanoid(40);
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await prisma.session.create({ data: { userId, token, expiresAt } });

  const jwt = await new SignJWT({ sub: userId, jti: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  const jwt = store.get(COOKIE_NAME)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, secretKey());
      if (typeof payload.jti === "string") {
        await prisma.session.deleteMany({ where: { token: payload.jti } });
      }
    } catch {
      /* token already invalid */
    }
  }
  store.delete(COOKIE_NAME);
}

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const jwt = store.get(COOKIE_NAME)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    if (typeof payload.jti !== "string" || typeof payload.sub !== "string") return null;
    const session = await prisma.session.findUnique({ where: { token: payload.jti } });
    if (!session || session.expiresAt < new Date()) return null;
    return session.userId;
  } catch {
    return null;
  }
});

export const getCurrentUser = cache(async () => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { theme: true },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
