import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findPack } from "@/lib/coins";
import { createPayOrder } from "@/lib/db";
import { createUpstreamPayment, payConfigured, payOrderNo } from "@/lib/pay";
import { isPayChannel } from "@/lib/pricing";

export const runtime = "nodejs";

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  return "127.0.0.1";
}

/** 法币下单目前只用于充值金币。解锁 / 买断 / 征稿改走金币余额。 */
export async function POST(req: Request) {
  try {
    if (!payConfigured()) {
      return NextResponse.json({ ok: false, msg: "支付未配置，请联系站长" }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, msg: "请先登录" }, { status: 401 });

    const body = (await req.json()) as { kind?: string; packId?: string; channel?: string };
    if (body.kind !== "topup") {
      return NextResponse.json({ ok: false, msg: "请使用金币购买；法币仅用于充值" }, { status: 400 });
    }
    const channel = body.channel || "004";
    if (!isPayChannel(channel)) {
      return NextResponse.json({ ok: false, msg: "请选择微信或支付宝" }, { status: 400 });
    }
    const pack = findPack(body.packId || "");
    if (!pack) return NextResponse.json({ ok: false, msg: "请选择充值档位" }, { status: 400 });

    const amountFen = pack.yuan * 100;
    const mchOrderNo = payOrderNo();
    const upstream = await createUpstreamPayment({
      mchOrderNo,
      amountFen,
      userId: user.id,
      userIp: clientIp(req),
      remark: `充值${pack.coins}金币`.slice(0, 40),
      returnPath: `/pay/r/${encodeURIComponent(mchOrderNo)}`,
      product: channel,
    });
    createPayOrder({
      mchOrderNo,
      userId: user.id,
      kind: "topup",
      workId: null,
      amountFen,
      payUrl: upstream.payUrl,
      serialOrderNo: upstream.serialOrderNo,
    });
    return NextResponse.json({
      ok: true,
      mchOrderNo,
      payUrl: upstream.payUrl,
      yuan: pack.yuan,
      coins: pack.coins,
      channel,
      kind: "topup",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, msg: error instanceof Error ? error.message : "下单失败" },
      { status: 500 },
    );
  }
}
