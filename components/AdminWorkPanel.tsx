"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import {
  adminDeleteWorkAction,
  adminGenerateCoverAction,
  adminReplaceContentAction,
  adminRereviewAction,
  adminUpdateWorkAction,
  adminUploadCoverAction,
} from "@/lib/actions";
import { countWords } from "@/lib/format";
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
  aiCoverReady,
}: {
  workId: number;
  title: string;
  score: number;
  status: string;
  price: number;
  kind: string;
  summary: string;
  aiCoverReady: boolean;
}) {
  const [genState, genAction, genPending] = useActionState(adminGenerateCoverAction, initial);
  const [coverState, coverAction, coverPending] = useActionState(adminUploadCoverAction, initial);
  const [replaceState, replaceAction, replacePending] = useActionState(adminReplaceContentAction, initial);
  const [reviewState, reviewAction, reviewPending] = useActionState(adminRereviewAction, initial);
  const [editState, editAction, editPending] = useActionState(adminUpdateWorkAction, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(adminDeleteWorkAction, initial);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [replaceKind, setReplaceKind] = useState(kind === "novel" ? "novel" : "script");

  async function onScriptFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setFileError("文件请小于 5MB");
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !/^text\//.test(file.type || "")) {
      setFileError("请上传 .md / .txt 文件");
      return;
    }
    setFileError("");
    setFileName(file.name);
    setContent(await file.text());
  }

  const words = countWords(content);
  const tooShort = words > 0 && words < 200;
  const tooLong = words > 500000;

  return (
    <section className="admin-panel" aria-label="管理员">
      <div className="section-title">
        <h2>站长管理</h2>
        <a href="/ops/works">全部稿件</a>
      </div>
      <p className="hint">《{title}》· 重新上传正文 / AI 封面 / 复审 / 改档位</p>

      <form className="form admin-form" action={replaceAction}>
        <input type="hidden" name="workId" value={workId} />
        <p className="hint" style={{ marginTop: 0 }}>
          用新的 Markdown 覆盖这篇正文。作品编号、作者、评分、价格和已购买记录都会保留。
        </p>
        <label>
          体裁
          <select name="kind" value={replaceKind} onChange={(event) => setReplaceKind(event.target.value)}>
            <option value="script">短剧剧本</option>
            <option value="novel">小说</option>
          </select>
        </label>
        <div className="field">
          <span>{replaceKind === "novel" ? "新小说文件" : "新剧本文件"}（.md / .txt，≤5MB）</span>
          <label className="btn ghost file-btn">
            {fileName ? `已选：${fileName}` : "选择文件"}
            <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onScriptFile} />
          </label>
        </div>
        <label>
          正文（可改）
          <textarea
            name="content"
            required
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="选择文件后会显示在这里，也可以直接粘贴。"
          />
        </label>
        <p className={`hint${tooShort || tooLong ? " upload-warn" : ""}`}>
          当前 {words} 字
          {tooShort ? " · 至少 200 字" : tooLong ? " · 已超过 50 万字上限" : words > 0 ? " · 可以替换" : ""}
        </p>
        {fileError ? <p className="alert">{fileError}</p> : null}
        {replaceState.error ? (
          <p className="alert" role="alert">
            {replaceState.error}
          </p>
        ) : null}
        <button className="btn solid" type="submit" disabled={replacePending || tooShort || tooLong || words === 0}>
          {replacePending ? "替换中…" : replaceKind === "novel" ? "用这份小说替换正文" : "用这份剧本替换正文"}
        </button>
      </form>

      <form className="form admin-form" action={genAction}>
        <input type="hidden" name="workId" value={workId} />
        <p className="hint" style={{ marginTop: 0 }}>
          {aiCoverReady
            ? "上传稿件后会自动尝试 AI 出图；也可点下面按钮重新生成。"
            : "服务器尚未配置 AI 出图（AI_IMAGE_MODEL + API Key）。配置后即可一键生成。"}
        </p>
        {genState.error ? (
          <p className="alert" role="alert">
            {genState.error}
          </p>
        ) : null}
        <button className="btn solid" type="submit" disabled={genPending || !aiCoverReady}>
          {genPending ? "AI 出图中…" : "AI 生成封面"}
        </button>
      </form>

      <form className="form admin-form" action={coverAction}>
        <input type="hidden" name="workId" value={workId} />
        <label>
          或手动上传封面（可选）
          <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" required />
        </label>
        {coverState.error ? (
          <p className="alert" role="alert">
            {coverState.error}
          </p>
        ) : null}
        <button className="btn ghost" type="submit" disabled={coverPending}>
          {coverPending ? "上传中…" : "保存本地封面"}
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

      <form
        className="form admin-form"
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm(`确定删除《${title}》？删除后不可恢复。`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="workId" value={workId} />
        {deleteState.error ? (
          <p className="alert" role="alert">
            {deleteState.error}
          </p>
        ) : null}
        <button className="btn danger" type="submit" disabled={deletePending}>
          {deletePending ? "删除中…" : kind === "novel" ? "删除这篇小说" : "删除这篇剧本"}
        </button>
      </form>
    </section>
  );
}
