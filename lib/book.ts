import { safeMarkdownUrl } from "@/lib/format";

/** 从 ![alt](url) 起读到与之配对的右括号。 */
function readImage(text: string, from = 0) {
  const start = text.slice(from).search(/!\[[^\]]*]\(/);
  if (start < 0) return null;
  const at = from + start;
  const open = text.indexOf("(", at);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        const inner = text.slice(open + 1, i).trim();
        const url = inner.startsWith("<") ? inner.slice(1).split(">")[0] : inner.split(/\s+/)[0];
        return { at, raw: text.slice(at, i + 1), url: url || "" };
      }
    }
  }
  return null;
}

/** 取出正文里的第一张配图，并从右页正文里拿掉全部图片。 */
export function extractBookPlate(markdown: string) {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  let image = "";
  let cleaned = text;
  let guard = 0;
  while (guard < 20) {
    const found = readImage(cleaned);
    if (!found) break;
    if (!image) image = safeMarkdownUrl(found.url);
    cleaned = `${cleaned.slice(0, found.at)}${cleaned.slice(found.at + found.raw.length)}`;
    guard += 1;
  }
  cleaned = cleaned
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { image: image || null, markdown: cleaned };
}

/** 按空行拆成可分页的块。 */
export function bookBlocks(markdown: string) {
  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** 一块太高时，从句读处切开。切不开则返回 null。 */
export function halveBlock(block: string): [string, string] | null {
  const trimmed = block.trim();
  if (trimmed.length < 24) return null;
  const marks = [...trimmed.matchAll(/[。！？!?；;]/g)];
  const usable = marks.filter((mark) => {
    const at = (mark.index ?? 0) + mark[0].length;
    return at >= 12 && trimmed.length - at >= 12;
  });
  const at = usable.length
    ? (usable[Math.floor((usable.length - 1) / 2)].index ?? 0) +
      usable[Math.floor((usable.length - 1) / 2)][0].length
    : Math.floor(trimmed.length / 2);
  const left = trimmed.slice(0, at).trim();
  const right = trimmed.slice(at).trim();
  if (!left || !right || left === trimmed) return null;
  return [left, right];
}

/** 按每块高度把下标装进页，单块超高时单独占一页。 */
export function packByHeight(heights: number[], maxHeight: number) {
  const limit = Math.max(1, maxHeight);
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    const size = Math.max(0, height);
    if (current.length > 0 && used + size > limit) {
      pages.push(current);
      current = [index];
      used = size;
      return;
    }
    current.push(index);
    used += size;
  });
  if (current.length) pages.push(current);
  if (!pages.length) pages.push([]);
  return pages;
}
