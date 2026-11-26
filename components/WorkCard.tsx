import { categoryName } from "@/lib/categories";
import { coverSrc } from "@/lib/cover";
import { formatReads, kindLabel, shelfPriceLabel, shelfSpec } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export function WorkCard({ work }: { work: PublicWork }) {
  const stamp = work.grade === "未过" ? "stamp bad" : "stamp";
  return (
    <a className={`card cat-${work.category}`} href={`/works/${work.id}`}>
      <div className="card-poster">
        <img src={coverSrc(work.id)} alt="" />
        <span className={stamp}>{work.grade}</span>
        <span className="card-reads">{formatReads(work.readCount)}</span>
        <div className="card-top">
          <span className={`badge ${work.kind}`}>{kindLabel(work.kind)}</span>
          <span className="badge light">{categoryName(work.category)}</span>
        </div>
        <div className="card-shade">
          <h3>{work.title}</h3>
          <p>{work.summary}</p>
          <div className="card-foot">
            <span>
              {work.author}
              <span className="hint">{shelfSpec(work.kind, work.wordCount)}</span>
            </span>
            <strong>
              {work.buyoutTaken ? "已买断" : shelfPriceLabel(work.price, work.score, work.episodeCount)}
            </strong>
          </div>
        </div>
      </div>
    </a>
  );
}
