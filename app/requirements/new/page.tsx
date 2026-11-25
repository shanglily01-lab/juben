import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RequirementForm } from "@/components/RequirementForm";
import { getCurrentUser } from "@/lib/auth";
import { MIN_REQUIREMENT_YUAN } from "@/lib/pricing";

export const metadata: Metadata = { title: "发布征稿" };

export default async function NewRequirementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/requirements/new");

  return (
    <div className="wrap page">
      <p className="kicker">定制</p>
      <h1>发布征稿</h1>
      <p className="intro">
        写清题材与规格，自填赏金（最低 ¥{MIN_REQUIREMENT_YUAN}）。付款后进入制作，交稿后仅你本人可读。
      </p>
      <RequirementForm />
    </div>
  );
}
