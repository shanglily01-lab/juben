import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { openSeal, seal } from "@/lib/auth";

function forged(payload: { uid?: number; exp?: number }, secret = process.env.SESSION_SECRET || "") {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

describe("登录票据", () => {
  it("签出来的票据能读回同一个用户", () => {
    expect(openSeal(seal(7))).toBe(7);
  });

  it("空票据、被改过的签名、过期票据都拒绝", () => {
    expect(openSeal(undefined)).toBeNull();
    expect(openSeal("abc")).toBeNull();
    const token = seal(3);
    expect(openSeal(`${token}x`)).toBeNull();
    expect(openSeal(forged({ uid: 3, exp: Date.now() - 1000 }))).toBeNull();
    expect(openSeal(forged({ uid: 3, exp: Date.now() + 60_000 }, "other-secret"))).toBeNull();
    expect(openSeal(forged({ exp: Date.now() + 60_000 }))).toBeNull();
  });
});
