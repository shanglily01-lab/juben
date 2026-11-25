export type Episode = {
  index: number;
  title: string;
  /** 含标题的 markdown，可直接交给 Reader */
  body: string;
};

/** 按二级标题（##）拆集；没有标题时整篇算一集。 */
export function splitEpisodes(markdown: string): Episode[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ index: 1, title: "正文", body: "" }];

  const matches = [...text.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ index: 1, title: "全文", body: text }];
  }

  const episodes: Episode[] = [];
  const firstAt = matches[0].index ?? 0;
  const before = text.slice(0, firstAt).trim();
  if (before) {
    episodes.push({ index: 1, title: "开篇", body: before });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1].trim() || `第 ${episodes.length + 1} 集`;
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const section = text.slice(start, end).trim();
    episodes.push({
      index: episodes.length + 1,
      title,
      body: `## ${title}\n\n${section}`,
    });
  }

  return episodes;
}

export function clampEpisode(ep: number, total: number) {
  if (!Number.isFinite(ep) || total <= 0) return 1;
  return Math.min(Math.max(Math.trunc(ep), 1), total);
}
