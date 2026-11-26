import { CATEGORIES, isCategory, type CategorySlug } from "@/lib/categories";
import type { Kind } from "@/lib/types";

export type WorkMeta = {
  title: string;
  summary: string;
  category: CategorySlug;
  kind: Kind;
};

const CATEGORY_HINTS: Record<CategorySlug, string[]> = {
  suspense: ["悬疑", "推理", "谋杀", "失踪", "线索", "真相", "凶手", "密室"],
  history: ["历史", "朝堂", "皇帝", "状元", "古代", "王朝", "钦差", "府衙"],
  disaster: ["灾难", "地震", "封城", "末日", "逃生", "瘟疫", "台风", "坍塌"],
  transmigration: ["穿越", "重生", "回到", "穿成", "系统", "另一个时空"],
  romance: ["言情", "恋爱", "喜欢", "暗恋", "分手", "婚礼", "心动"],
  scifi: ["科幻", "飞船", "机器人", "未来", "太空", "克隆", "人工智能", "芯片"],
  urban: ["都市", "公司", "写字楼", "地铁", "北漂", "加班", "手机"],
  wuxia: ["武侠", "江湖", "剑", "门派", "掌门", "内力", "侠客"],
};

function clampTitle(raw: string) {
  return raw.replace(/[#*_`>\-\[\]()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
}

function clampSummary(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 100);
}

export function parseKind(raw: unknown): Kind | undefined {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "script" || value === "短剧" || value === "剧本") return "script";
  if (value === "novel" || value === "小说") return "novel";
  return undefined;
}

/** 无强制指定时，从正文痕迹猜短剧 / 小说。 */
export function guessKind(content: string): Kind {
  const text = content.slice(0, 4000);
  let novel = 0;
  let script = 0;
  if (/第[一二三四五六七八九十百千零\d]+章/.test(text)) novel += 3;
  if (/小说|网文|主角|她想|他想|心中暗道/.test(text)) novel += 2;
  if (/第[一二三四五六七八九十\d]+场/.test(text)) script += 3;
  if (/^[△▲]|旁白[：:]|切至|特写|OS[：:]/m.test(text)) script += 3;
  if (/[：:]\s*\S+/.test(text) && /场/.test(text)) script += 1;
  if (novel > script) return "novel";
  return "script";
}

/** 无 AI 时：从 Markdown 标题/首段/关键词猜元数据。 */
export function extractMetaLocal(content: string, forcedKind?: Kind): WorkMeta {
  const text = content.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n").map((line) => line.trim());
  const kind = forcedKind || guessKind(text);
  const fallbackTitle = kind === "novel" ? "未命名小说" : "未命名短剧";

  let title = "";
  const heading = lines.find((line) => /^#{1,3}\s+\S/.test(line));
  if (heading) title = clampTitle(heading.replace(/^#{1,3}\s+/, ""));
  if (!title) {
    const plain = lines.find((line) => line && !line.startsWith("```") && !/^[-*|]/.test(line));
    title = clampTitle(plain || fallbackTitle);
  }
  if (title.length < 2) title = fallbackTitle;

  const bodyLines = lines.filter((line) => {
    if (!line) return false;
    if (/^#{1,6}\s/.test(line)) return false;
    if (/^```/.test(line)) return false;
    return true;
  });
  let summary = clampSummary(bodyLines.slice(0, 3).join(""));
  if (summary.length < 10) {
    summary = clampSummary(
      kind === "novel"
        ? `${title}。根据上传小说自动生成的简介，打开正文可看完整内容。`
        : `${title}。根据上传剧本自动生成的简介，打开正文可看完整场面。`,
    );
  }
  if (summary.length < 10) {
    summary =
      kind === "novel" ? "小说投稿，打开正文可看完整故事。" : "短剧剧本投稿，打开正文可看完整场面与对白。";
  }
  if (summary.length > 100) summary = summary.slice(0, 100);

  const hay = `${title}\n${summary}\n${text.slice(0, 2000)}`;
  let best: CategorySlug = "urban";
  let bestScore = 0;
  for (const item of CATEGORIES) {
    let score = 0;
    for (const hint of CATEGORY_HINTS[item.slug]) {
      if (hay.includes(hint)) score += hint.length > 1 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item.slug;
    }
  }

  return { title, summary, category: best, kind };
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeMeta(data: Record<string, unknown>, fallback: WorkMeta, forcedKind?: Kind): WorkMeta {
  const title = clampTitle(String(data.title || fallback.title));
  let summary = clampSummary(String(data.summary || fallback.summary));
  if (summary.length < 10) summary = fallback.summary;
  if (summary.length > 100) summary = summary.slice(0, 100);
  const categoryRaw = String(data.category || fallback.category);
  const category = isCategory(categoryRaw) ? categoryRaw : fallback.category;
  const kind = forcedKind || parseKind(data.kind) || fallback.kind;
  return {
    title: title.length >= 2 ? title : fallback.title,
    summary,
    category,
    kind,
  };
}

/** AI 识别标题 / 简介 / 分类 / 体裁；失败则回退本地规则。forcedKind 优先。 */
export async function extractWorkMeta(
  content: string,
  options: { kind?: Kind } = {},
): Promise<WorkMeta & { source: "local" | "model" }> {
  const forcedKind = options.kind;
  const local = extractMetaLocal(content, forcedKind);
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return { ...local, source: "local" };

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "gemini-3.8-flash";
  const categories = CATEGORIES.map((item) => item.slug).join("、");
  const kindHint = forcedKind
    ? `体裁已指定为 ${forcedKind === "novel" ? "小说" : "短剧剧本"}，kind 必须原样输出。`
    : "kind 只能是 script（短剧剧本）或 novel（小说），按正文判断。";
  const prompt = [
    "你是中文内容编辑。请阅读下面的 Markdown，识别元数据。",
    "只输出一个 JSON 对象，不要 Markdown。",
    `字段：title（2到30字中文标题）、summary（10到100字中文简介）、category（只能是：${categories}）、kind（script 或 novel）。`,
    kindHint,
    "根据正文主剧情判断分类，标题不要带书名号。",
    "正文：",
    content.slice(0, 12000),
  ].join("\n");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "你只输出 JSON，用于投稿元数据。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return { ...local, source: "local" };
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) return { ...local, source: "local" };
    return { ...normalizeMeta(extractJsonObject(text), local, forcedKind), source: "model" };
  } catch {
    return { ...local, source: "local" };
  }
}
