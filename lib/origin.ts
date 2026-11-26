import { headers } from "next/headers";

function normalizeConfigured(raw: string | undefined) {
  const configured = raw?.trim().replace(/\/$/, "") ?? "";
  if (!/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i.test(configured)) return "";
  return configured;
}

function normalizeProto(raw: string | null | undefined) {
  const proto = (raw ?? "").split(",")[0]?.trim().toLowerCase();
  return proto === "https" ? "https" : "http";
}

function normalizeHost(raw: string | null | undefined) {
  const host = (raw ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!host || host.length > 255) return "";
  const ipv6 = host.match(/^\[([0-9a-f:]+)\](?::(\d{1,5}))?$/);
  if (ipv6) {
    const port = ipv6[2] ? Number(ipv6[2]) : 0;
    if (ipv6[2] && (port < 1 || port > 65535)) return "";
    return host;
  }
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) return "";
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return "";
  const colon = host.lastIndexOf(":");
  if (colon >= 0) {
    const port = Number(host.slice(colon + 1));
    if (port < 1 || port > 65535) return "";
  }
  return host;
}

/** Absolute site origin for links that leave the browser, such as activation mail. */
export function publicOrigin(input: {
  configured?: string;
  proto?: string | null;
  host?: string | null;
  allowRequestHost?: boolean;
}) {
  const configured = normalizeConfigured(input.configured);
  if (configured) return configured;
  if (!input.allowRequestHost) return "";
  const host = normalizeHost(input.host);
  if (!host) return "";
  return `${normalizeProto(input.proto)}://${host}`;
}

export async function requestOrigin() {
  const headerStore = await headers();
  return publicOrigin({
    configured: process.env.APP_ORIGIN,
    proto: headerStore.get("x-forwarded-proto"),
    host: headerStore.get("host"),
    allowRequestHost: process.env.NODE_ENV !== "production",
  });
}

/** 支付回跳/通知必须用稳定绝对域名，避免落到空白页或支付方域名。 */
export async function payOrigin() {
  const configured = publicOrigin({ configured: process.env.APP_ORIGIN });
  if (configured) return configured;
  // 生产兜底：宁可固定主域，也不能拼出相对地址让上游回跳丢站
  if (process.env.NODE_ENV === "production") return "https://dahuangshu.vip";
  const live = await requestOrigin();
  return live || "http://127.0.0.1:3000";
}
