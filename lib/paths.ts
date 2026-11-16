import path from "node:path";

export function dataDir() {
  return process.env.MOBEN_DATA_DIR || path.join(process.cwd(), "data");
}
