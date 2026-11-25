import { NextResponse } from "next/server";

import { fulfillPayOrder } from "@/lib/pay-fulfill";
import { verifyPaySign } from "@/lib/pay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.PAY_MCH_SECRET?.trim();
  if (!secret) return new NextResponse("CONFIG", { status: 500 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse("BAD_JSON", { status: 400 });
  }

  if (!verifyPaySign(body, secret)) {
    return new NextResponse("SIGN_ERROR", { status: 400 });
  }

  const status = `${body.payStatus || ""}`;
  const mchOrderNo = `${body.mchOrderNo || ""}`;
  if (!mchOrderNo) return new NextResponse("NO_ORDER", { status: 400 });

  if (status === "SUCCESS") {
    const result = fulfillPayOrder(mchOrderNo, body.serialOrderNo ? String(body.serialOrderNo) : undefined);
    if (!result.ok) {
      console.error("[pay/notify]", result.error, mchOrderNo);
      return new NextResponse("FAIL", { status: 500 });
    }
  }

  return new NextResponse("SUCCESS", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
