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
      <h1>上传短剧 / 小说</h1>
      <p className="intro">
        先选体裁，再上传 Markdown。标题、简介、分类自动识别，上传后直接上架；封面会尽量按主剧情生成。
      </p>
      <ul className="rules upload-rules">
        <li>体裁：短剧剧本 或 小说，上传时必选，书库会分别打标签。</li>
        <li>格式：仅支持 .md / .markdown（也可用纯文本粘贴）。</li>
        <li>字数：至少 200 字；建议 400 字以上；上限 50 万字。</li>
        <li>文件：单个文件不超过 5MB；每人最多保存 50 篇。</li>
        <li>短剧：请写清场次、人物、△动作和对白；小说：建议分章。</li>
        <li>流程：当前为批量上架，上传即发布到书库，不做严审拦截。</li>
        <li>封面：上传后自动按正文用 AI 出图，一般不用手动上传；未配出图 API 时用站内模板图。</li>
      </ul>
      <UploadForm />
    </div>
  );
}
