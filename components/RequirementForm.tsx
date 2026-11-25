"use client";

import { useActionState } from "react";

import { createRequirementAction } from "@/lib/actions";
import { CATEGORIES } from "@/lib/categories";
import { MIN_REQUIREMENT_COINS } from "@/lib/pricing";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function RequirementForm() {
  const [state, action, pending] = useActionState(createRequirementAction, initial);

  return (
    <form className="form" action={action}>
      {state.error ? <p className="alert">{state.error}</p> : null}
      <label>
        标题
        <input name="title" required maxLength={80} placeholder="一句话说清要什么剧" />
      </label>
      <input type="hidden" name="kind" value="script" />
      <p className="hint">征稿类型：短剧剧本</p>
      <label>
        分类
        <select name="category" defaultValue={CATEGORIES[0].slug} required>
          {CATEGORIES.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        内容要求
        <textarea
          name="brief"
          required
          rows={8}
          maxLength={4000}
          placeholder="题材、人设、集数/时长、风格、禁忌、交付格式……写得越清楚，交稿越准。"
        />
      </label>
      <label>
        对标账号 / 剧名（可选）
        <input name="reference" maxLength={500} placeholder="例如：某抖音号 / 某短剧名" />
      </label>
      <label>
        赏金（金币）
        <input
          name="bounty"
          type="number"
          required
          min={MIN_REQUIREMENT_COINS}
          step={10}
          defaultValue={MIN_REQUIREMENT_COINS}
        />
      </label>
      <p className="hint">
        最低 {MIN_REQUIREMENT_COINS} 金（约 ¥{MIN_REQUIREMENT_COINS / 10}）。余额不足请先充值。交稿仅你本人可读。
      </p>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "提交中…" : "提交并去付款"}
      </button>
    </form>
  );
}
