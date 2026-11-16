"use client";

import { useRef, useState } from "react";

export function CopyField({ value }: { value: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
    } catch {
      field.current?.focus();
      field.current?.select();
      setDone(false);
    }
  }

  return (
    <div className="search">
      <input ref={field} readOnly value={value} aria-label="邀请链接" />
      <button className="btn solid" type="button" onClick={() => void copy()}>
        {done ? "已复制" : "复制"}
      </button>
    </div>
  );
}
