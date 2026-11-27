import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { coverSrc } from "@/lib/cover";
import { listOpsWorks } from "@/lib/db";
import { formatDate, kindLabel } from "@/lib/format";

export const metadata: Metadata = { title: "稿件管理" };

export default async function OpsWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cover?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/login?next=/ops/works");
  }

  const params = await searchParams;
  const status = params.status || "";
  const q = params.q || "";
  const items = listOpsWorks({ q, status, limit: 120 });

  return (
    <div className="wrap page">
      <p className="kicker">站长</p>
      <h1>稿件管理</h1>
      <p className="intro">
        用 <strong>admin</strong> 账号登录即可管理：换封面、重新上传正文、复审评分、上下架。征稿交付仍在{" "}
        <a href="/ops/requirements">/ops/requirements</a>。
      </p>

      <form className="form desk-search" action="/ops/works" method="get" style={{ marginBottom: 16 }}>
        <label>
          搜索
          <input name="q" defaultValue={q} placeholder="标题 / 简介 / 作者" />
        </label>
        <label>
          状态
          <select name="status" defaultValue={status}>
            <option value="">全部</option>
            <option value="published">已上架</option>
            <option value="pending">待审</option>
            <option value="rejected">未过</option>
          </select>
        </label>
        <button className="btn" type="submit">
          筛选
        </button>
      </form>

      {items.length === 0 ? (
        <p className="empty">没有稿件。</p>
      ) : (
        <ul className="ops-work-list">
          {items.map((work) => (
            <li key={work.id}>
              <a className="ops-work-row" href={`/works/${work.id}`}>
                <img src={coverSrc(work.id)} alt="" width={48} height={64} />
                <span className="ops-work-body">
                  <strong>{work.title}</strong>
                  <small>
                    {kindLabel(work.kind)} · {categoryName(work.category)} · {work.grade} ·{" "}
                    {work.score.toFixed(1)} 分 · {work.status === "published" ? "已上架" : work.status === "pending" ? "待审" : "未过"} ·{" "}
                    {formatDate(work.createdAt)}
                  </small>
                </span>
                <span className="mine-menu-chev" aria-hidden>
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
