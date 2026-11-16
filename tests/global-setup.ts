import fs from "node:fs";

export default function setup() {
  return () => {
    const dir = process.env.MOBEN_DATA_DIR;
    if (dir?.includes(`${pathSegment()}moben-test-`)) fs.rmSync(dir, { recursive: true, force: true });
  };
}

function pathSegment() {
  return process.platform === "win32" ? "\\" : "/";
}
