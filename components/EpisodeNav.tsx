export function EpisodeNav({
  workId,
  current,
  total,
  title,
  prevTitle,
  nextTitle,
  unit = "集",
}: {
  workId: number;
  current: number;
  total: number;
  title: string;
  prevTitle?: string;
  nextTitle?: string;
  unit?: string;
}) {
  if (total <= 1) return null;
  const prev = current > 1 ? current - 1 : null;
  const next = current < total ? current + 1 : null;

  return (
    <nav className="episode-nav" aria-label={unit === "章" ? "分章导航" : "分集导航"}>
      <p className="episode-status">
        第 {current} / {total} {unit}
        <span className="hint"> · {title}</span>
      </p>
      <div className="episode-actions">
        {prev ? (
          <a className="btn ghost" href={`/works/${workId}?ep=${prev}`}>
            上一{unit}
            {prevTitle ? ` · ${prevTitle}` : ""}
          </a>
        ) : (
          <span className="btn ghost is-disabled" aria-disabled="true">
            上一{unit}
          </span>
        )}
        {next ? (
          <a className="btn solid" href={`/works/${workId}?ep=${next}`}>
            下一{unit}
            {nextTitle ? ` · ${nextTitle}` : ""}
          </a>
        ) : (
          <span className="btn solid is-disabled" aria-disabled="true">
            已是最后一{unit}
          </span>
        )}
      </div>
    </nav>
  );
}
