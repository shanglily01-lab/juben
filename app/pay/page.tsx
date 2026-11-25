import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "购买" };

/** 购买入口在作品页；保留路由以免旧链接 404。 */
export default function PayPage() {
  redirect("/browse");
}
