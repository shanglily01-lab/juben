"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import { uploadAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { countWords } from "@/lib/format";
import type { ActionState, Kind } from "@/lib/types";

const initial: ActionState = { error: "" };

export function UploadForm() {
  const [state, formAction] = useActionState(uploadAction, initial);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [kind, setKind] = useState<Kind>("script");

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setFileError("文件请小于 5MB");
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
  const tooLong = words > 500000;

  return (
    <form className="form" action={formAction}>
      <fieldset className="kind-picker">
        <legend>体裁</legend>
        <label className={`kind-option${kind === "script" ? " on" : ""}`}>
          <input
            type="radio"
            name="kind"
            value="script"
            checked={kind === "script"}
            onChange={() => setKind("script")}
          />
          <strong>短剧剧本</strong>
          <span>分场、对白、△动作</span>
        </label>
        <label className={`kind-option${kind === "novel" ? " on" : ""}`}>
          <input
            type="radio"
            name="kind"
            value="novel"
            checked={kind === "novel"}
            onChange={() => setKind("novel")}
          />
          <strong>小说</strong>
          <span>章节叙事、小说正文</span>
        </label>
      </fieldset>

      <div className="field">
        <span>{kind === "novel" ? "小说文件" : "剧本文件"}（.md，≤5MB）</span>
        <label className="btn ghost file-btn">
          {fileName ? `已选：${fileName}` : "选择 .md 文件"}
          <input type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={onFile} />
        </label>
        <p className="hint">
          {kind === "novel"
            ? "建议用一级标题写书名，正文按章节组织。"
            : "建议文件内用一级标题写剧名；也可不写，交给 AI 从正文识别。"}
        </p>
      </div>

      <label className="field">
        <span>正文预览（可改）</span>
        <textarea
          name="content"
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            kind === "novel"
              ? "选好文件后会显示在这里；也可以直接粘贴。\n\n示例：\n# 书名\n\n第一章 …"
              : "选好文件后会显示在这里；也可以直接粘贴。\n\n示例：\n# 剧名\n\n第一场 …\n△动作\n角色：对白"
          }
        />
        <p className={`hint${tooShort || tooLong ? " upload-warn" : ""}`}>
          当前 {words} 字
          {tooShort
            ? " · 至少 200 字才能送审"
            : weak
              ? " · 已可送审，建议再写到 400 字以上"
              : tooLong
                ? " · 已超过 50 万字上限，请删减后再提交"
                : words === 0
                  ? " · 200～500000 字 · 建议 400 字以上"
                  : " · 符合字数要求"}
        </p>
      </label>

      {fileError ? <p className="alert">{fileError}</p> : null}
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="上传并上架" pending="识别并上架中…" />
    </form>
  );
}
