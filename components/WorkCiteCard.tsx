import { categoryName } from "@/lib/categories";
import { kindLabel } from "@/lib/format";

export type WorkCite = {
  id: number;
  title: string;
  author?: string | null;
  kind?: string | null;
  grade?: string | null;
  category?: string | null;
};

/** 社区帖里引用的某一部剧本卡片。 */
export function WorkCiteCard({ work, compact = false }: { work: WorkCite; compact?: boolean }) {
  return (
    <a className={`work-cite${compact ? " compact" : ""}`} href={`/works/${work.id}`}>
      <img src={`/covers/${work.id}`} alt="" />
      <span className="work-cite-body">
        <strong>《{work.title}》</strong>
        <span className="hint">
          {work.kind ? kindLabel(work.kind) : "作品"}
          {work.category ? ` · ${categoryName(work.category)}` : ""}
          {work.author ? ` · ${work.author}` : ""}
          {work.grade ? ` · ${work.grade}` : ""}
          {` · #${work.id}`}
        </span>
      </span>
    </a>
  );
}
