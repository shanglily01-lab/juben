import type { Review } from "@/lib/types";

const LABELS = [
  ["plot", "情节"],
  ["character", "人物"],
  ["pacing", "节奏"],
  ["language", "文字"],
  ["completeness", "完整"],
] as const;

export function ReviewCard({ review }: { review: Review }) {
  return (
    <aside className="review">
      <div className="score-line">
        <h2>审核 {review.grade}</h2>
        <strong>{review.score.toFixed(1)}</strong>
      </div>
      <p>{review.summary}</p>
      <ul className="bars">
        {LABELS.map(([key, label]) => (
          <li key={key}>
            <span>{label}</span>
            <span className="track">
              <span style={{ width: `${review.dimensions[key] * 10}%` }} />
            </span>
            <span>{review.dimensions[key].toFixed(1)}</span>
          </li>
        ))}
      </ul>
      {review.advice.length > 0 ? (
        <ul className="advice">
          {review.advice.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <p className="hint">{review.source === "model" ? "模型审核" : "规则审核"}</p>
    </aside>
  );
}
