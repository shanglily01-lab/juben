import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { findUserById, isMainAuthorEmail } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "moben_session";
/** 登录后保持 90 天，避免每次打开都重新输账号密码。 */
const MAX_AGE = 60 * 60 * 24 * 90;

function secret() {
  return process.env.SESSION_SECRET || "moben-dev-secret-change-me";
}

export function seal(userId: number) {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString(
    "base64url",
  );
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openSeal(token: string | undefined) {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid?: number; exp?: number };
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = openSeal(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = findUserById(userId);
  if (!user?.email_verified_at) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    coins: user.coins,
  };
}

/** 主账号「大黄书」登录即为管理员。 */
export function isAdminUser(user: SessionUser | null | undefined) {
  return Boolean(user && isMainAuthorEmail(user.email));
}

export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return isAdminUser(user) ? user : null;
}

export async function setSession(userId: number) {
  const jar = await cookies();
  const secure = (process.env.APP_ORIGIN || "").startsWith("https://");
  jar.set(SESSION_COOKIE, seal(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
