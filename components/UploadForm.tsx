"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import { uploadAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORIES } from "@/lib/categories";
import { countWords } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function UploadForm() {
  const [state, formAction] = useActionState(uploadAction, initial);
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
      <input type="hidden" name="kind" value="script" />
      <p className="hint">目前只收短剧剧本。</p>
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
          placeholder="建议包含场次、人物、△动作和对白。"
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
