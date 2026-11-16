import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeInviteCode() {
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Empty string means the visitor did not enter a code. Null means the text is not a code. */
export function normalizeInviteCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return "";
  if (!/^[A-Z0-9]{6,10}$/.test(code)) return null;
  return code;
}
