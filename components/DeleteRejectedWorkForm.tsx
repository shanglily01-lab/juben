"use client";

import { useActionState } from "react";

import { deleteRejectedWorkAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function DeleteRejectedWorkForm({ workId }: { workId: number }) {
  const [state, formAction] = useActionState(deleteRejectedWorkAction, initial);

  return (
    <form
      className="delete-rejected"
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("确定删除这篇未过审的稿？删除后不可恢复。")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="workId" value={workId} />
      <SubmitButton idle="删除这篇" pending="删除中…" className="btn ghost danger" />
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
