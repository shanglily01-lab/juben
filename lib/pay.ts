import { createHash, randomBytes } from "node:crypto";

import { BUYOUT_YUAN, unlockYuanFromScore, type PayChannelId } from "@/lib/pricing";
import { requestOrigin } from "@/lib/origin";

/** 法币订单目前只用于充值入金币；旧 unlock/buyout/requirement 保留兼容。 */
export type PayKind = "topup" | "buyout" | "unlock" | "requirement";
export type { PayChannelId } from "@/lib/pricing";
export { PAY_CHANNELS, isPayChannel } from "@/lib/pricing";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

export function payConfigured() {
  return Boolean(process.env.PAY_MCH_KEY?.trim() && process.env.PAY_MCH_SECRET?.trim());
}

export function signParams(params: Record<string, string | number>, secret: string) {
  const pairs = Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== null && `${params[key]}` !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`);
  return createHash("md5").update(`${pairs.join("&")}${secret}`, "utf8").digest("hex");
}

export function verifyPaySign(params: Record<string, unknown>, secret: string) {
  const incoming = `${params.sign || ""}`.toLowerCase();
  if (!incoming) return false;
  const flat: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "sign" || value === undefined || value === null || `${value}` === "") continue;
    flat[key] = typeof value === "number" || typeof value === "string" ? value : String(value);
  }
  return signParams(flat, secret).toLowerCase() === incoming;
}

export function payNonce(size = 16) {
  return randomBytes(size).toString("hex").slice(0, 32);
}

export function payOrderNo() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `DH${stamp}${randomBytes(3).toString("hex")}`;
}

export function amountFenFor(kind: PayKind, score?: number, bountyYuan?: number, episodeCount = 1) {
  if (kind === "buyout") return BUYOUT_YUAN * 100;
  if (kind === "requirement") return Math.max(0, Math.floor(bountyYuan ?? 0)) * 100;
  if (kind === "topup") return Math.max(0, Math.floor(bountyYuan ?? 0)) * 100;
  return unlockYuanFromScore(score ?? 6, episodeCount) * 100;
}

export async function createUpstreamPayment(input: {
  mchOrderNo: string;
  amountFen: number;
  userId: number;
  userIp: string;
  remark: string;
  returnPath: string;
  product: PayChannelId;
}) {
  const mchKey = requireEnv("PAY_MCH_KEY");
  const secret = requireEnv("PAY_MCH_SECRET");
  const apiBase = (process.env.PAY_API_BASE || "https://tsapi-ruihe.tsqqai.com").replace(/\/$/, "");
  const origin = await requestOrigin();
  if (!origin) throw new Error("未配置 APP_ORIGIN，无法生成支付回调地址");

  const payload: Record<string, string | number> = {
    mchKey,
    product: input.product,
    mchOrderNo: input.mchOrderNo,
    amount: input.amountFen,
    nonce: payNonce(),
    timestamp: String(Date.now()),
    notifyUrl: `${origin}/api/pay/notify`,
    returnUrl: `${origin}${input.returnPath}`,
    mchUserId: String(input.userId),
    userIp: input.userIp,
    remark: input.remark.slice(0, 40),
  };
  payload.sign = signParams(payload, secret);

  const response = await fetch(`${apiBase}/api/v1/payment/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: {
    code?: string | number;
    msg?: string;
    data?: { url?: { payUrl?: string }; serialOrderNo?: string; payStatus?: string };
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(text || `上游返回异常 HTTP ${response.status}`);
  }
  if (response.status !== 200 || `${data.code}` !== "200") {
    throw new Error(data.msg || `下单失败 HTTP ${response.status}`);
  }
  const payUrl = data.data?.url?.payUrl || "";
  if (!payUrl) throw new Error("上游未返回支付链接");
  return {
    payUrl,
    serialOrderNo: data.data?.serialOrderNo || "",
    payStatus: data.data?.payStatus || "PROCESSING",
  };
}

export async function queryUpstreamPayment(mchOrderNo: string) {
  const mchKey = requireEnv("PAY_MCH_KEY");
  const secret = requireEnv("PAY_MCH_SECRET");
  const apiBase = (process.env.PAY_API_BASE || "https://tsapi-ruihe.tsqqai.com").replace(/\/$/, "");
  const query: Record<string, string> = {
    mchKey,
    mchOrderNo,
    nonce: payNonce(),
    timestamp: String(Date.now()),
  };
  query.sign = signParams(query, secret);
  const qs = new URLSearchParams(query).toString();
  const response = await fetch(`${apiBase}/api/v1/payment/query?${qs}`);
  const data = (await response.json()) as {
    code?: string | number;
    msg?: string;
    data?: { payStatus?: string; serialOrderNo?: string; realAmount?: number };
  };
  if (response.status !== 200 || `${data.code}` !== "200") {
    throw new Error(data.msg || `查单失败 HTTP ${response.status}`);
  }
  return data.data || {};
}
