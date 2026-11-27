"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { bookBlocks, halveBlock, packByHeight } from "@/lib/book";
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

function signatureOf(pages: number[][]) {
  return pages.map((group) => group.join(",")).join("|");
}

export function BookReader({
  markdown,
  plateSrc,
  chapterTitle,
  cut,
  prevChapterHref,
  nextChapterHref,
}: {
  markdown: string;
  plateSrc: string;
  chapterTitle: string;
  cut: boolean;
  prevChapterHref?: string;
  nextChapterHref?: string;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<string[]>(() => bookBlocks(markdown));
  const [pages, setPages] = useState<number[][]>(() => [blocks.map((_, index) => index)]);
  const [page, setPage] = useState(0);
  const [plateFailed, setPlateFailed] = useState(false);

  useEffect(() => {
    const next = bookBlocks(markdown);
    setBlocks(next);
    setPages([next.map((_, index) => index)]);
    setPage(0);
    setPlateFailed(false);
  }, [markdown, plateSrc]);

  useLayoutEffect(() => {
    const text = textRef.current;
    const measure = measureRef.current;
    if (!text || !measure) return;

    const measureNow = () => {
      const style = getComputedStyle(text);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const width = Math.max(0, text.clientWidth - padX);
      const max = text.clientHeight;
      if (width < 8 || max < 8) return;
      measure.style.width = `${width}px`;
      const heights = [...measure.children].map((node) => (node as HTMLElement).offsetHeight);
      const tooTall = heights.findIndex((height) => height > max + 1);
      if (tooTall >= 0) {
        const halves = halveBlock(blocks[tooTall] || "");
        if (halves) {
          setBlocks((current) => [
            ...current.slice(0, tooTall),
            halves[0],
            halves[1],
            ...current.slice(tooTall + 1),
          ]);
          return;
        }
      }
      const packed = heights.length ? packByHeight(heights, max) : [[]];
      setPages((current) => (signatureOf(current) === signatureOf(packed) ? current : packed));
      setPage((current) => Math.min(current, Math.max(0, packed.length - 1)));
    };

    measureNow();
    const observer = new ResizeObserver(measureNow);
    observer.observe(text);
    const fonts = document.fonts?.ready.then(measureNow);
    return () => {
      observer.disconnect();
      void fonts;
    };
  }, [blocks]);

  const total = Math.max(1, pages.length);
  const safePage = cut ? 0 : Math.min(page, total - 1);
  const visible = (pages[safePage] ?? []).map((index) => blocks[index]).filter(Boolean);
  const atStart = safePage <= 0;
  const atEnd = cut || safePage >= total - 1;

  function goPrev() {
    if (!atStart) setPage((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (cut || safePage >= pages.length - 1) return;
    setPage((current) => current + 1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (event.key === "ArrowLeft") {
        if (!atStart) {
          event.preventDefault();
          setPage((current) => Math.max(0, current - 1));
        }
      } else if (event.key === "ArrowRight" && !cut && safePage < pages.length - 1) {
        event.preventDefault();
        setPage((current) => current + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atStart, cut, pages.length, safePage]);

  const prevControl = !atStart ? (
    <button className="btn ghost" type="button" onClick={goPrev}>
      上一页
    </button>
  ) : prevChapterHref ? (
    <a className="btn ghost" href={prevChapterHref}>
      上一章
    </a>
  ) : (
    <span className="btn ghost is-disabled" aria-disabled="true">
      上一页
    </span>
  );

  const nextControl = !atEnd ? (
    <button className="btn solid" type="button" onClick={goNext}>
      下一页
    </button>
  ) : nextChapterHref && !cut ? (
    <a className="btn solid" href={nextChapterHref}>
      下一章
    </a>
  ) : (
    <span className="btn solid is-disabled" aria-disabled="true">
      {cut ? "试读到此" : "已是最后一页"}
    </span>
  );

  return (
    <div className="book-stage">
      <div className="book-spread" role="group" aria-label="打开的书">
        <figure className="book-leaf verso">
          {plateFailed ? (
            <div className="book-plate book-plate-fallback">
              <p>{chapterTitle}</p>
            </div>
          ) : (
            <div className="book-plate">
              <img src={plateSrc} alt="" onError={() => setPlateFailed(true)} />
            </div>
          )}
          <figcaption>{chapterTitle}</figcaption>
        </figure>
        <div className="book-gutter" aria-hidden />
        <article className="book-leaf recto" aria-label="正文">
          <div className="book-text book-prose" ref={textRef}>
            <div className="book-measure book-prose" ref={measureRef} aria-hidden>
              {blocks.map((block, index) => (
                <div className="book-block" key={`${index}-${block.slice(0, 24)}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeMarkdownUrl} components={components}>
                    {block}
                  </ReactMarkdown>
                </div>
              ))}
            </div>
            {visible.length ? (
              visible.map((block, index) => (
                <div className="book-block" key={`${safePage}-${index}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeMarkdownUrl} components={components}>
                    {block}
                  </ReactMarkdown>
                </div>
              ))
            ) : (
              <p className="book-empty">这一页还没有正文。</p>
            )}
            {cut ? <div className="book-fade" aria-hidden /> : null}
          </div>
          <p className="book-folio">
            {cut ? "试读" : `${safePage + 1} / ${total}`}
          </p>
        </article>
      </div>
      <div className="book-turn">
        {prevControl}
        <p>
          {cut ? "试读" : `第 ${safePage + 1} / ${total} 页`}
          {chapterTitle ? <span className="hint"> · {chapterTitle}</span> : null}
        </p>
        {nextControl}
      </div>
    </div>
  );
}
