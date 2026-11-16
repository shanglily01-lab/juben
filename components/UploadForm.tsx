"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import { uploadAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORIES } from "@/lib/categories";
import { countWords } from "@/lib/format";
import type { ActionState, Kind } from "@/lib/types";

const initial: ActionState = { error: "" };

export function UploadForm() {
  const [state, formAction] = useActionState(uploadAction, initial);
  const [kind, setKind] = useState<Kind>("script");
  const [content, setContent] = useState("");
  const [fileError, setFileError] = useState("");

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setFileError("文件请小于 400KB");
      return;
    }
    setFileError("");
    setContent(await file.text());
  }

  return (
    <form className="form" action={formAction}>
      <div className="choice">
        <label>
          <input type="radio" name="kind" value="script" checked={kind === "script"} onChange={() => setKind("script")} />
          短剧剧本
        </label>
        <label>
          <input type="radio" name="kind" value="novel" checked={kind === "novel"} onChange={() => setKind("novel")} />
          小说
        </label>
      </div>
      <label className="field">
        <span>标题</span>
        <input name="title" required minLength={2} maxLength={30} placeholder="不超过 30 个字" />
      </label>
      <label className="field">
        <span>分类</span>
        <select name="category" defaultValue="suspense">
          {CATEGORIES.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>简介</span>
        <textarea name="summary" required minLength={10} maxLength={100} style={{ minHeight: 96 }} placeholder="10 到 100 字，写给还没打开正文的人" />
      </label>
      <label className="field">
        <span>定价（金币，0 为免费）</span>
        <input name="price" inputMode="numeric" defaultValue="0" min={0} max={99} />
      </label>
      <div className="field">
        <span>正文 Markdown</span>
        <label className="btn ghost file-btn">
          从手机或电脑选择 .md
          <input type="file" accept=".md,text/markdown,text/plain" onChange={onFile} />
        </label>
        <textarea
          name="content"
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={kind === "script" ? "建议包含场次、人物、△动作和对白。" : "直接粘贴章节，或从 Markdown 文件读入。"}
        />
        <p className="hint">{countWords(content)} 字 · 至少 200 字才会送审，400 字以上才有机会通过</p>
      </div>
      {fileError ? <p className="alert">{fileError}</p> : null}
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="提交并审核" pending="正在审核…" />
    </form>
  );
}
