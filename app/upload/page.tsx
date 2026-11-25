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
      <p className="intro">只需上传一份 Markdown 剧本。标题、简介、分类由 AI 识别，封面按主剧情生成。</p>
      <ul className="rules upload-rules">
        <li>格式：仅支持 .md / .markdown（也可用纯文本粘贴）。</li>
        <li>字数：至少 200 字才能送审；建议 400 字以上；上限 10 万字。</li>
        <li>文件：单个文件不超过 2MB。</li>
        <li>内容：请写清场次、人物、△动作和对白；过短、注水、人物分不清会被拒。</li>
        <li>流程：提交后自动识别元数据并审核；过审即上架，未过只你自己看得到意见。</li>
        <li>封面：过审后按主剧情 AI 生成竖版封面，无需自传图。</li>
      </ul>
      <UploadForm />
    </div>
  );
}
