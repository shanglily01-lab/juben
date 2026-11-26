"use client";

import { useActionState } from "react";

import {
  adminRereviewAction,
  adminUpdateWorkAction,
  adminUploadCoverAction,
} from "@/lib/actions";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function AdminWorkPanel({
  workId,
  title,
  score,
  status,
  price,
  kind,
  summary,
}: {
  workId: number;
  title: string;
  score: number;
  status: string;
  price: number;
  kind: string;
  summary: string;
}) {
  const [coverState, coverAction, coverPending] = useActionState(adminUploadCoverAction, initial);
  const [reviewState, reviewAction, reviewPending] = useActionState(adminRereviewAction, initial);
  const [editState, editAction, editPending] = useActionState(adminUpdateWorkAction, initial);

  return (
    <section className="admin-panel" aria-label="管理员">
      <div className="section-title">
        <h2>站长管理</h2>
        <a href="/ops/works">全部稿件</a>
      </div>
      <p className="hint">《{title}》· 换封面 / 复审 / 改档位</p>

      <form className="form admin-form" action={coverAction}>
        <input type="hidden" name="workId" value={workId} />
        <label>
          上传封面（PNG / JPG / WEBP，≤4MB）
          <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" required />
        </label>
        {coverState.error ? (
          <p className="alert" role="alert">
            {coverState.error}
          </p>
        ) : null}
        <button className="btn solid" type="submit" disabled={coverPending}>
          {coverPending ? "上传中…" : "保存封面"}
        </button>
      </form>

      <form className="form admin-form" action={reviewAction}>
        <input type="hidden" name="workId" value={workId} />
        {reviewState.error ? (
          <p className="alert" role="alert">
            {reviewState.error}
          </p>
        ) : null}
        <button className="btn ghost" type="submit" disabled={reviewPending}>
          {reviewPending ? "复审中…" : "重新审核（AI/规则）"}
        </button>
      </form>

      <form className="form admin-form" action={editAction}>
        <input type="hidden" name="workId" value={workId} />
        <label>
          综合分（1–10）
          <input name="score" type="number" min={1} max={10} step={0.1} defaultValue={score} required />
        </label>
        <label>
          体裁
          <select name="kind" defaultValue={kind === "novel" ? "novel" : "script"}>
            <option value="script">短剧剧本</option>
            <option value="novel">小说</option>
          </select>
        </label>
        <label>
          状态
          <select name="status" defaultValue={status}>
            <option value="published">已上架</option>
            <option value="pending">待审</option>
            <option value="rejected">未过</option>
          </select>
        </label>
        <label>
          是否收费
          <select name="paid" defaultValue={price > 0 ? "1" : "0"}>
            <option value="0">免费</option>
            <option value="1">按分收费</option>
          </select>
        </label>
        <label>
          复审备注
          <textarea name="note" rows={2} defaultValue={summary} placeholder="可选，会写入审核摘要" />
        </label>
        {editState.error ? (
          <p className="alert" role="alert">
            {editState.error}
          </p>
        ) : null}
        <button className="btn solid" type="submit" disabled={editPending}>
          {editPending ? "保存中…" : "保存复审结果"}
        </button>
      </form>
    </section>
  );
}
