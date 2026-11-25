"use client";

import { useActionState, useEffect, useState } from "react";

import { createDiscussionAction } from "@/lib/actions";
import { WorkCiteCard, type WorkCite } from "@/components/WorkCiteCard";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

/** 作品页留言（无标题） */
export function WorkDiscussionForm({ workId }: { workId: number }) {
  const [state, action, pending] = useActionState(createDiscussionAction, initial);
  return (
    <form className="form discussion-form" action={action}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="next" value={`/works/${workId}#discussion`} />
      {state.error ? <p className="alert">{state.error}</p> : null}
      <label>
        说两句
        <textarea name="body" required rows={3} maxLength={1000} placeholder="剧情、人物、改编想法……" />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "发布中…" : "发布留言"}
      </button>
    </form>
  );
}

type CiteOption = WorkCite;

/** 社区发帖：必须引用一部已上架剧本（可搜标题 / 填作品 ID）。 */
export function CommunityPostForm({
  initialCite = null,
}: {
  initialCite?: CiteOption | null;
}) {
  const [state, action, pending] = useActionState(createDiscussionAction, initial);
  const [query, setQuery] = useState(initialCite ? `#${initialCite.id} ${initialCite.title}` : "");
  const [cite, setCite] = useState<CiteOption | null>(initialCite);
  const [hits, setHits] = useState<CiteOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (cite) return;
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/works/lookup?q=${encodeURIComponent(q)}`);
        const data = (await response.json()) as { ok?: boolean; works?: CiteOption[] };
        if (!cancelled) setHits(data.works || []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, cite]);

  return (
    <form className="form discussion-form" action={action}>
      <input type="hidden" name="next" value="/community" />
      <input type="hidden" name="workId" value={cite?.id ?? ""} />
      {state.error ? <p className="alert">{state.error}</p> : null}

      <label>
        引用剧本
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCite(null);
          }}
          placeholder="搜标题、作者，或直接填作品编号"
          autoComplete="off"
          aria-autocomplete="list"
        />
      </label>
      {cite ? (
        <div className="cite-picked">
          <WorkCiteCard work={cite} />
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setCite(null);
              setQuery("");
              setHits([]);
            }}
          >
            更换
          </button>
        </div>
      ) : (
        <div className="cite-hits" role="listbox" aria-label="搜索结果">
          {searching ? <p className="hint">查找中…</p> : null}
          {!searching && query.trim() && hits.length === 0 ? (
            <p className="hint">没找到已上架剧本，换个关键词或作品编号试试。</p>
          ) : null}
          {hits.map((work) => (
            <button
              key={work.id}
              type="button"
              className="cite-hit"
              onClick={() => {
                setCite(work);
                setQuery(`#${work.id} ${work.title}`);
                setHits([]);
              }}
            >
              <WorkCiteCard work={work} compact />
            </button>
          ))}
        </div>
      )}
      {!cite ? <p className="hint">发帖需引用一部具体剧本，方便读者点进去对照。</p> : null}

      <label>
        标题
        <input name="title" required maxLength={60} placeholder="想聊什么？" />
      </label>
      <label>
        正文
        <textarea name="body" required rows={5} maxLength={2000} placeholder="读后感、求推、改编脑洞……" />
      </label>
      <button className="btn" type="submit" disabled={pending || !cite}>
        {pending ? "发布中…" : "发到社区"}
      </button>
    </form>
  );
}
