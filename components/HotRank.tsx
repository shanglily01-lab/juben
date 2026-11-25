import { formatPurchases, formatReads, kindLabel } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export type RankMetric = "reads" | "purchases" | "recommend";

export function HotRank({
  works,
  metric = "reads",
}: {
  works: PublicWork[];
  metric?: RankMetric;
}) {
  if (works.length === 0) return null;
  return (
    <ol className="hot-rank">
      {works.map((work, index) => (
        <li key={work.id}>
          <a href={`/works/${work.id}`}>
            <span className={`hot-rank-no${index < 3 ? " top" : ""}`}>{index + 1}</span>
            <span className="hot-rank-body">
              <strong>{work.title}</strong>
              <span className="hint">
                {kindLabel(work.kind)}
                {metric === "purchases"
                  ? ` · ${formatPurchases(work.purchaseCount)}`
                  : metric === "recommend"
                    ? ` · ${work.grade} · ${work.score.toFixed(1)}分 · ${formatReads(work.readCount)}`
                    : ` · ${formatReads(work.readCount)}`}
              </span>
            </span>
            <img src={`/covers/${work.id}`} alt="" />
          </a>
        </li>
      ))}
    </ol>
  );
}
