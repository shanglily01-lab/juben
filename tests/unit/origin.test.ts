import { describe, expect, it } from "vitest";

import { publicOrigin } from "@/lib/origin";

describe("站点地址", () => {
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
});
