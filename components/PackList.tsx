"use client";

import { useActionState } from "react";

import { rechargeAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PACKS } from "@/lib/coins";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function PackList() {
  return (
    <div className="packs">
      {PACKS.map((pack) => (
        <PackForm key={pack.id} id={pack.id} label={pack.label} coins={pack.coins} yuan={pack.yuan} />
      ))}
    </div>
  );
}

function PackForm({ id, label, coins, yuan }: { id: string; label: string; coins: number; yuan: number }) {
  const [state, formAction] = useActionState(rechargeAction, initial);
  return (
    <form className="pack" action={formAction}>
      <input type="hidden" name="pack" value={id} />
      <p>
        {label}
        <br />
        <strong>{coins} 金币</strong>
      </p>
      {state.error ? <p className="alert">{state.error}</p> : null}
      <SubmitButton idle={`演示价 ¥${yuan}`} pending="正在入账…" />
    </form>
  );
}
