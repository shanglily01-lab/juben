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
        现阶段先批量上传入库：只需 Markdown。标题、简介、分类会自动识别；审核与封面稍后再统一处理。
      </p>
      <ul className="rules upload-rules">
        <li>格式：仅支持 .md / .markdown（也可用纯文本粘贴）。</li>
        <li>字数：至少 200 字；建议 400 字以上；上限 10 万字。</li>
        <li>文件：单个文件不超过 2MB；每人最多保存 50 篇。</li>
        <li>内容：请写清场次、人物、△动作和对白，方便稍后过审。</li>
        <li>流程：上传后状态为「待审」，不上架；只有你自己看得到，可随时删除。</li>
        <li>后续：攒够一批后再统一过审，并按主剧情生成封面。</li>
      </ul>
      <UploadForm />
    </div>
  );
}
