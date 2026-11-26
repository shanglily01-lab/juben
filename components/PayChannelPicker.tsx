"use client";

import { AlipayIcon, WeChatIcon } from "@/components/PayIcons";
import { PAY_CHANNELS, type PayChannelId } from "@/lib/pricing";

/** 支付宝优先展示（与青果一致：微信风控较严）。 */
const ORDERED = [...PAY_CHANNELS].sort((a, b) => (a.id === "004" ? -1 : b.id === "004" ? 1 : 0));

export function PayChannelPicker({
  value,
  onChange,
  disabled,
}: {
  value: PayChannelId;
  onChange: (id: PayChannelId) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="pay-radios" disabled={disabled}>
      <legend className="pay-radios-legend">支付方式</legend>
      {ORDERED.map((item) => {
        const checked = value === item.id;
        const wechat = item.id === "005";
        return (
          <label key={item.id} className={`pay-radio${checked ? " on" : ""}${wechat ? " wechat" : " alipay"}`}>
            <input
              type="radio"
              name="pay-channel"
              value={item.id}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(item.id)}
            />
            <span className="pay-radio-dot" aria-hidden />
            {wechat ? <WeChatIcon /> : <AlipayIcon />}
            <span className="pay-radio-text">
              {item.short}
              {!wechat ? <small className="pay-radio-tag">推荐</small> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
