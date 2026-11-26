import { afterEach, describe, expect, it } from "vitest";

import { payOrigin, publicOrigin } from "@/lib/origin";

describe("站点地址", () => {
  const original = { ...process.env };
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  });

  it("优先用配置的地址，并拒绝被请求头拼出来的链接", () => {
    expect(
      publicOrigin({
        configured: "https://moben.example/",
        proto: "http://evil.test",
        host: "evil.test",
        allowRequestHost: true,
      }),
    ).toBe("https://moben.example");

    expect(
      publicOrigin({
        configured: "https://user@evil.test",
        proto: "https",
        host: "127.0.0.1:3000",
        allowRequestHost: true,
      }),
    ).toBe("https://127.0.0.1:3000");

    expect(
      publicOrigin({
        proto: "http://evil.test",
        host: "127.0.0.1:3000",
        allowRequestHost: true,
      }),
    ).toBe("http://127.0.0.1:3000");

    expect(
      publicOrigin({
        proto: "https",
        host: "evil.test\r\nX-Injected: 1",
        allowRequestHost: true,
      }),
    ).toBe("");

    expect(
      publicOrigin({
        proto: "https",
        host: "127.0.0.1:3000",
        allowRequestHost: false,
      }),
    ).toBe("");
  });

  it("支付回跳域名优先 APP_ORIGIN，生产有兜底主域", async () => {
    process.env.APP_ORIGIN = "https://dahuangshu.vip";
    expect(await payOrigin()).toBe("https://dahuangshu.vip");

    delete process.env.APP_ORIGIN;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    expect(await payOrigin()).toBe("https://dahuangshu.vip");
  });
});
