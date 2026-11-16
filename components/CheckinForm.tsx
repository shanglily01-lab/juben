"use client";

import { useActionState } from "react";

import { checkinAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function CheckinForm({ checkedIn, reward }: { checkedIn: boolean; reward: number }) {
  const [state, action] = useActionState(checkinAction, initial);
  if (checkedIn) return <p className="note">今天已经签过，北京时间明天 0 点后再来。</p>;
  return (
    <form action={action}>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle={`签到 +${reward} 金币`} pending="正在入账…" />
    </form>
  );
}
