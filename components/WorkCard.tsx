import { categoryName } from "@/lib/categories";
import { kindLabel, priceLabel, shelfSpec } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export function WorkCard({ work }: { work: PublicWork }) {
  const stamp = work.grade === "未过" ? "stamp bad" : "stamp";
  return (
    <a className={`card cat-${work.category}`} href={`/works/${work.id}`}>
      <div className="card-poster">
        <span className={stamp}>{work.grade}</span>
        <div className="card-top">
          <span className={`badge ${work.kind}`}>{kindLabel(work.kind)}</span>
          <span className="badge light">{categoryName(work.category)}</span>
        </div>
      </div>
      <div className="card-body">
        <h3>{work.title}</h3>
        <p>{work.summary}</p>
        <div className="card-foot">
          <span>
            {work.author}
            <br />
            <span className="hint">{shelfSpec(work.kind, work.wordCount)}</span>
          </span>
          <strong>{priceLabel(work.price)}</strong>
        </div>
      </div>
    </a>
  );
}
