/** 打开上游收银台。对齐青果(lvgdj)瑞禾接入：不能把 noopener 写进 features。 */

export function openPayUrl(payUrl: string) {
  if (!payUrl || typeof window === "undefined") return;
  // window.open(url, '_blank', 'noopener') 成功时也会返回 null，
  // 若据此再 location 跳转，会「一次点开两个支付页」并丢掉本站等待页。
  let win: Window | null = null;
  try {
    win = window.open(payUrl, "_blank");
  } catch {
    win = null;
  }
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    return;
  }
  window.location.href = payUrl;
}
