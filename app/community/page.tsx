import type { Metadata } from "next";

import { CommunityPostForm } from "@/components/DiscussionForm";
import { DiscussionList } from "@/components/DiscussionList";
import { getCurrentUser } from "@/lib/auth";
import { getWorkDetail, listRecentDiscussions } from "@/lib/db";

export const metadata: Metadata = { title: "读者社区" };

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ workId?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const items = listRecentDiscussions(50);

  const prefId = Number(params.workId || "");
  const prefWork =
    Number.isInteger(prefId) && prefId > 0 ? getWorkDetail(prefId) : undefined;
  const initialCite =
    prefWork && prefWork.status === "published"
      ? {
          id: prefWork.id,
          title: prefWork.title,
          author: prefWork.author,
          kind: prefWork.kind,
          grade: prefWork.grade,
          category: prefWork.category,
        }
      : null;

  return (
    <div className="wrap page">
      <p className="kicker">交流</p>
      <h1>读者社区</h1>
      <p className="intro">发帖须引用一部已上架剧本（搜标题或填作品编号），方便读者对照原文讨论。</p>

      <div className="section-title">
        <h2>发帖</h2>
      </div>
      {user ? (
        <CommunityPostForm initialCite={initialCite} />
      ) : (
        <p className="empty">
          <a
            href={`/login?next=${encodeURIComponent(
              initialCite ? `/community?workId=${initialCite.id}` : "/community",
            )}`}
          >
            登录
          </a>
          后即可发帖并引用剧本。
        </p>
      )}

      <div className="section-title">
        <h2>最新讨论</h2>
      </div>
      <DiscussionList items={items} currentUserId={user?.id} next="/community" showWorkCite />
    </div>
  );
}
