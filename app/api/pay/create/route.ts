import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  createPayOrder,
  getRequirement,
  getWorkDetail,
  hasUnlock,
  hasWorkBuyout,
  isWorkBuyoutTaken,
} from "@/lib/db";
import { amountFenFor, createUpstreamPayment, payConfigured, payOrderNo } from "@/lib/pay";
import { BUYOUT_YUAN, isPayChannel, unlockYuanFromScore } from "@/lib/pricing";
import { isPaidRequirementStatus } from "@/lib/requirements";

export const runtime = "nodejs";

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  return "127.0.0.1";
}

export async function POST(req: Request) {
  try {
    if (!payConfigured()) {
      return NextResponse.json({ ok: false, msg: "支付未配置，请联系站长" }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, msg: "请先登录" }, { status: 401 });

    const body = (await req.json()) as {
      kind?: string;
      workId?: number;
      requirementId?: number;
      channel?: string;
    };
    const kind =
      body.kind === "buyout" || body.kind === "unlock" || body.kind === "requirement" ? body.kind : null;
    if (!kind) return NextResponse.json({ ok: false, msg: "未知购买类型" }, { status: 400 });
    const channel = body.channel || "005";
    if (!isPayChannel(channel)) {
      return NextResponse.json({ ok: false, msg: "请选择微信或支付宝" }, { status: 400 });
    }

    if (kind === "requirement") {
      const requirementId = Number(body.requirementId);
      if (!Number.isInteger(requirementId) || requirementId <= 0) {
        return NextResponse.json({ ok: false, msg: "缺少征稿" }, { status: 400 });
      }
      const requirement = getRequirement(requirementId);
      if (!requirement) return NextResponse.json({ ok: false, msg: "征稿不存在" }, { status: 404 });
      if (requirement.user_id !== user.id) {
        return NextResponse.json({ ok: false, msg: "只能支付自己的征稿" }, { status: 403 });
      }
      if (isPaidRequirementStatus(requirement.status)) {
        return NextResponse.json({ ok: false, msg: "这笔征稿已支付" }, { status: 400 });
      }
      if (requirement.status !== "awaiting_pay") {
        return NextResponse.json({ ok: false, msg: "当前状态不能付款" }, { status: 400 });
      }

      const yuan = requirement.bounty_yuan;
      const amountFen = amountFenFor("requirement", undefined, yuan);
      const mchOrderNo = payOrderNo();
      const upstream = await createUpstreamPayment({
        mchOrderNo,
        amountFen,
        userId: user.id,
        userIp: clientIp(req),
        remark: `征稿《${requirement.title}》`.slice(0, 40),
        returnPath: `/pay/return?orderNo=${encodeURIComponent(mchOrderNo)}&requirementId=${requirement.id}`,
        product: channel,
      });
      createPayOrder({
        mchOrderNo,
        userId: user.id,
        kind: "requirement",
        workId: null,
        requirementId: requirement.id,
        amountFen,
        payUrl: upstream.payUrl,
        serialOrderNo: upstream.serialOrderNo,
      });
      return NextResponse.json({
        ok: true,
        mchOrderNo,
        payUrl: upstream.payUrl,
        yuan,
        channel,
        kind: "requirement",
      });
    }

    const workId = Number(body.workId);
    if (!Number.isInteger(workId) || workId <= 0) {
      return NextResponse.json({ ok: false, msg: "缺少作品" }, { status: 400 });
    }
    const work = getWorkDetail(workId);
    if (!work || work.status !== "published") {
      return NextResponse.json({ ok: false, msg: "这篇还不能购买" }, { status: 400 });
    }
    if (work.price <= 0) return NextResponse.json({ ok: false, msg: "这篇是免费的" }, { status: 400 });
    if (work.author_id === user.id) {
      return NextResponse.json({ ok: false, msg: "这是你自己的稿件" }, { status: 400 });
    }

    const taken = isWorkBuyoutTaken(work.id);
    const iOwn = hasWorkBuyout(user.id, work.id);
    if (taken && !iOwn) {
      return NextResponse.json({ ok: false, msg: "这篇已被他人买断，无法再购买" }, { status: 400 });
    }
    if (kind === "buyout" && iOwn) {
      return NextResponse.json({ ok: false, msg: "这篇已经由你买断" }, { status: 400 });
    }
    if (kind === "unlock" && (iOwn || hasUnlock(user.id, work.id))) {
      return NextResponse.json({ ok: false, msg: "已经可以阅读这篇" }, { status: 400 });
    }
    if (kind === "unlock" && taken) {
      return NextResponse.json({ ok: false, msg: "这篇已被买断" }, { status: 400 });
    }

    const episodes = Math.max(1, Number(work.episode_count) || 1);
    const yuan = kind === "buyout" ? BUYOUT_YUAN : unlockYuanFromScore(work.score, episodes);
    const amountFen = amountFenFor(kind, work.score, undefined, episodes);
    const mchOrderNo = payOrderNo();
    const label = kind === "buyout" ? "买断" : "购买";
    const upstream = await createUpstreamPayment({
      mchOrderNo,
      amountFen,
      userId: user.id,
      userIp: clientIp(req),
      remark: `${label}《${work.title}》`.slice(0, 40),
      returnPath: `/pay/return?orderNo=${encodeURIComponent(mchOrderNo)}&workId=${work.id}`,
      product: channel,
    });
    createPayOrder({
      mchOrderNo,
      userId: user.id,
      kind,
      workId: work.id,
      amountFen,
      payUrl: upstream.payUrl,
      serialOrderNo: upstream.serialOrderNo,
    });
    return NextResponse.json({ ok: true, mchOrderNo, payUrl: upstream.payUrl, yuan, channel, kind });
  } catch (error) {
    return NextResponse.json(
      { ok: false, msg: error instanceof Error ? error.message : "下单失败" },
      { status: 500 },
    );
  }
}
