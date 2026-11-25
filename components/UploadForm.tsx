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

  const words = countWords(content);
  const tooShort = words > 0 && words < 200;
  const weak = words >= 200 && words < 400;
  const tooLong = words > 100000;

  return (
    <form className="form" action={formAction}>
      <div className="field">
        <span>剧本文件（.md，≤2MB）</span>
        <label className="btn ghost file-btn">
          {fileName ? `已选：${fileName}` : "选择 .md 文件"}
          <input type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={onFile} />
        </label>
        <p className="hint">建议文件内用一级标题写剧名；也可不写，交给 AI 从正文识别。</p>
      </div>

      <label className="field">
        <span>正文预览（可改）</span>
        <textarea
          name="content"
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={"选好文件后会显示在这里；也可以直接粘贴。\n\n示例：\n# 剧名\n\n第一场 …\n△动作\n角色：对白"}
        />
        <p className={`hint${tooShort || tooLong ? " upload-warn" : ""}`}>
          当前 {words} 字
          {tooShort
            ? " · 至少 200 字才能送审"
            : weak
              ? " · 已可送审，满 400 字更易过审"
              : tooLong
                ? " · 已超过 10 万字上限，请删减后再提交"
                : words === 0
                  ? " · 200～100000 字 · 400 字以上更易过审"
                  : " · 符合字数要求"}
        </p>
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
