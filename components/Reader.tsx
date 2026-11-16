"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeMarkdownUrl } from "@/lib/format";

const components = {
  img: () => null,
  a: ({ href, children }: { href?: string; children?: ReactNode }) =>
    href ? (
      <a href={href} rel="noreferrer noopener" target="_blank">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
};

export function Reader({ markdown, cut }: { markdown: string; cut: boolean }) {
  return (
    <div className={cut ? "preview-wrap" : undefined}>
      <article className="reader">
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeMarkdownUrl} components={components}>
          {markdown}
        </ReactMarkdown>
      </article>
      {cut ? <div className="preview-fade" aria-hidden /> : null}
    </div>
  );
}
