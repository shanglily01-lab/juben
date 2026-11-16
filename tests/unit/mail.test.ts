import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: "test" })));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

import { latestOutboxLink, sendActivationMail, showMailPreview, smtpConfigured } from "@/lib/mail";

const original = {
  host: process.env.SMTP_HOST,
  from: process.env.MAIL_FROM,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  user: process.env.SMTP_USER,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  process.env.SMTP_HOST = original.host;
  process.env.MAIL_FROM = original.from;
  process.env.SMTP_PORT = original.port;
  process.env.SMTP_SECURE = original.secure;
  process.env.SMTP_USER = original.user;
  (process.env as { NODE_ENV?: string }).NODE_ENV = original.nodeEnv;
  sendMail.mockClear();
});

describe("激活信", () => {
  it("没配置发信时写入本机，并按收件人取最新一封", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    expect(smtpConfigured()).toBe(false);
    expect(showMailPreview()).toBe(true);

    await sendActivationMail({ to: "first@example.com", username: "甲", link: "http://localhost/activate?token=old" });
    await sendActivationMail({ to: "first@example.com", username: "甲", link: "http://localhost/activate?token=new" });
    await sendActivationMail({ to: "second@example.com", username: "乙", link: "http://localhost/activate?token=other" });

    expect(latestOutboxLink("first@example.com")).toContain("token=new");
    expect(latestOutboxLink("second@example.com")).toContain("token=other");
    expect(latestOutboxLink("missing@example.com")).toBe("");
  });

  it("配置了发信就走 SMTP，不再把链接留在本机", async () => {
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "1";
    process.env.SMTP_USER = "mailer";
    process.env.MAIL_FROM = "墨本 <noreply@example.com>";
    expect(smtpConfigured()).toBe(true);
    expect(showMailPreview()).toBe(false);

    const mode = await sendActivationMail({
      to: "smtp@example.com",
      username: "丙",
      link: "http://localhost/activate?token=smtp",
    });
    expect(mode).toBe("smtp");
    expect(sendMail).toHaveBeenCalledOnce();
    expect(latestOutboxLink("smtp@example.com")).toBe("");
  });

  it("正式环境没有 SMTP 时直接失败，不把链接留在本机", async () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    expect(showMailPreview()).toBe(false);
    await expect(
      sendActivationMail({
        to: "prod@example.com",
        username: "丁",
        link: "http://localhost/activate?token=prod",
      }),
    ).rejects.toThrow(/发信/);
    expect(latestOutboxLink("prod@example.com")).toBe("");
  });
});
