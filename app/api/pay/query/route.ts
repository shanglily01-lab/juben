import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findPayOrder } from "@/lib/db";
import { fulfillPayOrder } from "@/lib/pay-fulfill";
import { payConfigured, queryUpstreamPayment } from "@/lib/pay";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, msg: "请先登录" }, { status: 401 });

  const orderNo = new URL(req.url).searchParams.get("orderNo") || "";
  if (!orderNo) return NextResponse.json({ ok: false, msg: "缺少订单号" }, { status: 400 });

  const local = findPayOrder(orderNo);
  if (!local || local.user_id !== user.id) {
    return NextResponse.json({ ok: false, msg: "订单不存在" }, { status: 404 });
  }

  const orderPayload = {
    mchOrderNo: local.mch_order_no,
    kind: local.kind,
    workId: local.work_id,
    requirementId: local.requirement_id,
  };

  if (local.status === "SUCCESS") {
    return NextResponse.json({
      ok: true,
      order: { ...orderPayload, payStatus: "SUCCESS" },
    });
  }

  if (!payConfigured()) {
    return NextResponse.json({
      ok: true,
      order: { ...orderPayload, payStatus: String(local.status || "").toUpperCase() },
    });
  }

  try {
    const remote = await queryUpstreamPayment(orderNo);
    const payStatus = String(remote.payStatus || local.status || "").toUpperCase();
    if (payStatus === "SUCCESS") {
      fulfillPayOrder(orderNo, remote.serialOrderNo);
    }
    return NextResponse.json({
      ok: true,
      order: {
        ...orderPayload,
        payStatus,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      order: { ...orderPayload, payStatus: String(local.status || "").toUpperCase() },
      msg: error instanceof Error ? error.message : "查单失败",
    });
  }
}
