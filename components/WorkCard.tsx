import { categoryName } from "@/lib/categories";
import { formatDate, kindLabel, priceLabel } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export function WorkCard({ work }: { work: PublicWork }) {
  const stamp = work.grade === "未过" ? "stamp bad" : "stamp";
  return (
    <a className="card" href={`/works/${work.id}`}>
      <div className="card-top">
        <span className={`badge ${work.kind}`}>{kindLabel(work.kind)}</span>
        <span className="badge">{categoryName(work.category)}</span>
      </div>
      <span className={stamp}>{work.grade}</span>
      <h3>{work.title}</h3>
      <p>{work.summary}</p>
      <div className="meta">
        <span>{work.author}</span>
        <span>{work.wordCount} 字</span>
        <span>{priceLabel(work.price)}</span>
        <span>{formatDate(work.createdAt)}</span>
      </div>
    </a>
  );
}
