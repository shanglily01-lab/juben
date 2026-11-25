export function EpisodeNav({
  workId,
  current,
  total,
  title,
  prevTitle,
  nextTitle,
}: {
  workId: number;
  current: number;
  total: number;
  title: string;
  prevTitle?: string;
  nextTitle?: string;
}) {
  if (total <= 1) return null;
  const prev = current > 1 ? current - 1 : null;
  const next = current < total ? current + 1 : null;

  return (
    <nav className="episode-nav" aria-label="分集导航">
      <p className="episode-status">
        第 {current} / {total} 集
        <span className="hint"> · {title}</span>
      </p>
      <div className="episode-actions">
        {prev ? (
          <a className="btn ghost" href={`/works/${workId}?ep=${prev}`}>
            上一集{prevTitle ? ` · ${prevTitle}` : ""}
          </a>
        ) : (
          <span className="btn ghost is-disabled" aria-disabled="true">
            上一集
          </span>
        )}
        {next ? (
          <a className="btn solid" href={`/works/${workId}?ep=${next}`}>
            下一集{nextTitle ? ` · ${nextTitle}` : ""}
          </a>
        ) : (
          <span className="btn solid is-disabled" aria-disabled="true">
            已是最后一集
          </span>
        )}
      </div>
    </nav>
  );
}
