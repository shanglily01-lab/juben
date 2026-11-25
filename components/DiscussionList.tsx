import { deleteDiscussionAction } from "@/lib/actions";
import type { DiscussionRow } from "@/lib/db";
import { WorkCiteCard } from "@/components/WorkCiteCard";
import { formatDate } from "@/lib/format";

export function DiscussionList({
  items,
  currentUserId,
  next,
  showWorkCite = false,
}: {
  items: DiscussionRow[];
  currentUserId?: number;
  next: string;
  showWorkCite?: boolean;
}) {
  if (items.length === 0) {
    return <p className="empty">还没有讨论，来写第一条吧。</p>;
  }

  return (
    <ul className="discussion-list">
      {items.map((item) => {
        const cited =
          showWorkCite &&
          item.work_id &&
          item.work_title &&
          item.work_status === "published"
            ? {
                id: item.work_id,
                title: item.work_title,
                author: item.work_author,
                kind: item.work_kind,
                grade: item.work_grade,
                category: item.work_category,
              }
            : null;

        return (
          <li key={item.id} className="discussion-item">
            <div className="discussion-meta">
              <strong>{item.username}</strong>
              <span className="hint">{formatDate(item.created_at)}</span>
            </div>
            {item.title ? <h3 className="discussion-title">{item.title}</h3> : null}
            {cited ? <WorkCiteCard work={cited} /> : null}
            <p className="discussion-body">{item.body}</p>
            {currentUserId === item.user_id ? (
              <form action={deleteDiscussionAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="next" value={next} />
                <button className="text-btn danger" type="submit">
                  删除
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
