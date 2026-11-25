import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UploadForm } from "@/components/UploadForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "投稿" };

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/upload");

  return (
    <div className="wrap page">
      <p className="kicker">投稿</p>
      <h1>上传剧本</h1>
      <p className="intro">
        只需上传一份 Markdown。标题、简介、分类由 AI 识别，封面按主剧情生成；过审即上架，未过会留下意见，只有你自己看得到。
      </p>
      <UploadForm />
    </div>
  );
}
