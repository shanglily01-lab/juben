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
      <h1>把稿放进匣子</h1>
      <p className="intro">
        可以从手机里选一个 Markdown 文件，也可以直接写。提交后马上审核：过了就上架，不过会留下意见，只有你自己看得到。
      </p>
      <UploadForm />
    </div>
  );
}
