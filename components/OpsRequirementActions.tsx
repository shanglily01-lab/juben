"use client";

import { useActionState } from "react";

import { deliverRequirementAction, markRequirementMakingAction } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function OpsRequirementActions({
  requirementId,
  secret,
  status,
}: {
  requirementId: number;
  secret: string;
  status: string;
}) {
  const [deliverState, deliverAction, deliverPending] = useActionState(deliverRequirementAction, initial);
  const [makingState, makingAction, makingPending] = useActionState(markRequirementMakingAction, initial);

  return (
    <div className="ops-actions">
      {status === "paid" ? (
        <form action={makingAction}>
          <input type="hidden" name="secret" value={secret} />
          <input type="hidden" name="requirementId" value={requirementId} />
          <button className="btn ghost" type="submit" disabled={makingPending}>
            {makingPending ? "…" : "标为制作中"}
          </button>
          {makingState.error ? <p className="alert">{makingState.error}</p> : null}
        </form>
      ) : null}
      <form className="form ops-deliver" action={deliverAction}>
        <input type="hidden" name="secret" value={secret} />
        <input type="hidden" name="requirementId" value={requirementId} />
        <label>
          交付作品 ID
          <input name="workId" type="number" min={1} required placeholder="已上架作品的数字 ID" />
        </label>
        {deliverState.error ? <p className="alert">{deliverState.error}</p> : null}
        <button className="btn" type="submit" disabled={deliverPending}>
          {deliverPending ? "交付中…" : "确认交付并独占"}
        </button>
      </form>
    </div>
  );
}