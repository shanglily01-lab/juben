import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

import { dataDir } from "@/lib/paths";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

export function showMailPreview() {
  return !smtpConfigured() && process.env.NODE_ENV !== "production";
}

type OutboxMessage = {
  to: string;
  subject: string;
  text: string;
  link: string;
  createdAt: string;
};

function outboxDir() {
  return path.join(dataDir(), "outbox");
}

let outboxSequence = 0;

export async function sendActivationMail(input: { to: string; username: string; link: string }) {
  const subject = "激活墨本账号";
  const text = [
    `${input.username}，你好。`,
    "",
    "用下面的链接激活墨本账号。激活之后，注册赠送才会入账。链接 24 小时内有效。",
    "",
    input.link,
    "",
    "如果不是你本人操作，忽略这封信即可。",
  ].join("\n");

  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("正式环境还没配置发信");
    }
    const dir = outboxDir();
    fs.mkdirSync(dir, { recursive: true });
    const safe = input.to.replace(/[^a-z0-9@._-]/gi, "_");
    const file = path.join(outboxDir(), `${Date.now()}-${String(outboxSequence++).padStart(4, "0")}-${safe}.json`);
    const message: OutboxMessage = { to: input.to, subject, text, link: input.link, createdAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(message, null, 2));
    return "outbox" as const;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "1" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to: input.to, subject, text });
  return "smtp" as const;
}

export function latestOutboxLink(email: string) {
  const dir = outboxDir();
  if (!fs.existsSync(dir)) return "";
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
  for (const file of files) {
    try {
      const message = JSON.parse(fs.readFileSync(file, "utf8")) as OutboxMessage;
      if (message.to === email && message.link) return message.link;
    } catch {
      /* skip a broken outbox file */
    }
  }
  return "";
}
