import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "moben-test-"));
process.env.MOBEN_DATA_DIR = dataDir;

export default defineConfig({
  envDir: dataDir,
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      MOBEN_DATA_DIR: dataDir,
      SESSION_SECRET: "moben-test-secret",
      AI_API_KEY: "",
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      MAIL_FROM: "",
      APP_ORIGIN: "",
    },
  },
});
