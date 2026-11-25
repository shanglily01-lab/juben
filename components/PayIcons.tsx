/** 微信 / 支付宝识别色图标。 */

export function WeChatIcon({ className = "pay-brand-ico" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#07C160" />
      <path
        fill="#fff"
        d="M18.6 14.2c-5.1 0-9.2 3.5-9.2 7.8 0 2.5 1.4 4.7 3.6 6.1l-.9 2.9 3.3-1.7c1 .3 2 .4 3 .4.3 0 .7 0 1-.1-.3-.7-.4-1.4-.4-2.1 0-4.2 3.9-7.6 8.7-7.6.3 0 .7 0 1 .1-1.5-3.3-5.4-5.8-10.1-5.8zm-3.7 4.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm6.1 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z"
      />
      <path
        fill="#fff"
        d="M34.4 22.8c-4.2 0-7.6 2.9-7.6 6.5 0 2.1 1.2 4 3.1 5.2l-.7 2.3 2.7-1.4c.8.2 1.6.3 2.4.3 4.2 0 7.6-2.9 7.6-6.5s-3.3-6.4-7.5-6.4zm-2.8 4.2a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm4.9 0a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1z"
      />
    </svg>
  );
}

export function AlipayIcon({ className = "pay-brand-ico" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#1677FF" />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fill="#fff"
        fontSize="22"
        fontFamily="PingFang SC, Microsoft YaHei, sans-serif"
        fontWeight="700"
      >
        支
      </text>
    </svg>
  );
}
