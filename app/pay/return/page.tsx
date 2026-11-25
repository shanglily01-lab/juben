import type { Metadata } from "next";
import { Suspense } from "react";

import { PayReturnClient } from "@/components/PayReturnClient";

export const metadata: Metadata = { title: "支付结果" };

export default function PayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap page">
          <p className="kicker">支付回跳</p>
          <h1>支付结果</h1>
          <p className="intro">正在确认支付结果…</p>
        </div>
      }
    >
      <PayReturnClient />
    </Suspense>
  );
}
