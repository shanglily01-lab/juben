"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import { uploadAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { countWords } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function UploadForm() {
  const [state, formAction] = useActionState(uploadAction, initial);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setFileError("文件请小于 2MB");
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !/^text\//.test(file.type || "")) {
      setFileError("请上传 .md Markdown 文件");
      return;
    }
    setFileError("");
    setFileName(file.name);
    setContent(await file.text());
  }

  return (
    <form className="form" action={formAction}>
      <p className="hint">只需上传剧本 Markdown。标题、简介、分类和封面都由 AI 根据正文识别生成。</p>

      <div className="field">
        <span>剧本文件</span>
        <label className="btn ghost file-btn">
          {fileName ? `已选：${fileName}` : "选择 .md 文件"}
          <input type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={onFile} />
        </label>
      </div>

      <label className="field">
        <span>正文预览（可改）</span>
        <textarea
          name="content"
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="选好文件后会显示在这里；也可以直接粘贴 Markdown。"
        />
        <p className="hint">{countWords(content)} 字 · 至少 200 字才能送审，400 字以上才有机会通过</p>
      </label>

      {fileError ? <p className="alert">{fileError}</p> : null}
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="上传并由 AI 处理" pending="识别与审核中…" />
    </form>
  );
}
