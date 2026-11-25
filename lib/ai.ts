import { categoryName } from "@/lib/categories";
import { countWords, gradeOf } from "@/lib/format";
import type { Dimensions, Kind, Review } from "@/lib/types";

type ReviewInput = {
  title: string;
  kind: Kind;
  category: string;
  summary: string;
  content: string;
};

const WEIGHTS = {
  plot: 0.24,
  character: 0.22,
  pacing: 0.18,
  language: 0.2,
  completeness: 0.16,
} as const;

function clamp(value: number) {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}

function lowestAdvice(dimensions: Dimensions, kind: Kind) {
  const labels: { key: keyof Dimensions; text: string }[] = [
    {
      key: "plot",
      text: kind === "script" ? "把这场戏的转折写清楚，观众要知道局势变在哪里。" : "情节还缺一个让人记住的转弯。",
    },
    { key: "character", text: "人物的欲望和口气还不够分开，读者分不清是谁在做选择。" },
    { key: "pacing", text: "节奏可以再收一收，把不推动局面的句子删掉。" },
    { key: "language", text: "句子长短太接近，读起来发闷，可以拆开几句。" },
    { key: "completeness", text: "再补一场关键戏，这篇会更完整。" },
  ];
  labels.sort((a, b) => dimensions[a.key] - dimensions[b.key]);
  return labels.filter((item) => dimensions[item.key] < 6.5).slice(0, 2).map((item) => item.text);
}

export function reviewLocal(input: ReviewInput): Review {
  const text = input.content.trim();
  const chars = countWords(text);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const sentences = text.split(/[。！？]/).map((item) => item.trim()).filter(Boolean);
  const enders = text.match(/[。！？]/g)?.length ?? 0;
  const dialogue = lines.filter((line) => /[：:]/.test(line) || line.includes("「")).length;
  const advice: string[] = [];
  let hardFail = false;

  const dimensions: Dimensions = {
    plot: 6.4,
    character: 6.3,
    pacing: 6.3,
    language: 6.4,
    completeness: 6.2,
  };

  // 起步阶段放宽：满 200 字即可送审；400 字以上更稳，但不一律拒掉。
  if (chars < 200) {
    hardFail = true;
    dimensions.completeness = 2;
    advice.push("篇幅不够。短剧至少写完一场，再送审。");
  } else if (chars < 400) {
    dimensions.completeness = 5.8;
    advice.push("体量偏紧。补足到 400 字以上、写完一场关键戏，会更稳。");
  } else if (chars < 700) {
    dimensions.completeness = 6.8;
    advice.push(
      input.kind === "script"
        ? "体量偏紧。把最关键的那场再写具体一点，会更站得住。"
        : "体量偏紧。把最关键的那段再写具体一点，会更站得住。",
    );
  } else if (chars <= 6000) {
    dimensions.completeness = 8.2;
  } else {
    dimensions.completeness = 7.1;
    advice.push("篇幅偏长，投稿前先删掉重复交代。");
  }

  if (enders < 3) {
    hardFail = true;
    dimensions.language = 3.5;
    advice.push("完整的句子太少，还不像可以送审的稿。");
  } else if (enders < 5) {
    dimensions.language -= 0.4;
    advice.push("句子偏少，再补几句对白或叙述会更清楚。");
  }

  const compact = text.replace(/\s+/g, "");
  const grams = new Map<string, number>();
  for (let index = 0; index < compact.length - 3; index += 1) {
    const gram = compact.slice(index, index + 4);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  let maxRepeat = 0;
  for (const count of grams.values()) maxRepeat = Math.max(maxRepeat, count);
  if (/(.)\1{7,}/.test(compact) || maxRepeat > 18) {
    hardFail = true;
    dimensions.language = Math.min(dimensions.language, 3);
    dimensions.plot = Math.min(dimensions.plot, 4);
    advice.push("重复太明显，读起来像没有改完的堆字。");
  }

  if (input.kind === "script") {
    if (/第[一二三四五六七八九十0-9]+场/.test(text)) dimensions.plot += 0.8;
    else advice.push("短剧请标明场次，例如「第一场」。");
    if (/人物/.test(text)) dimensions.character += 0.5;
    if (/△|▲/.test(text)) dimensions.pacing += 0.6;
    if (dialogue >= 4) dimensions.character += 1.1;
    else {
      dimensions.character -= 0.8;
      advice.push("对白太少，人物还没有自己的声音。");
    }
  } else if (paragraphs.length >= 5) {
    dimensions.pacing += 0.8;
    if (dialogue >= 1) dimensions.character += 0.7;
  } else {
    dimensions.pacing -= 0.4;
    advice.push("小说分段再清楚一些，一段只做一件事。");
  }

  if (sentences.length >= 8) {
    const lengths = sentences.map((sentence) => sentence.length);
    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    const variance = lengths.reduce((sum, length) => sum + (length - average) ** 2, 0) / lengths.length;
    if (variance > 30) dimensions.language += 0.8;
    if (average > 70) {
      dimensions.language -= 0.7;
      advice.push("长句偏多，观众和读者都容易走神。");
    }
  }

  if (/[，。！？、]/.test(text)) dimensions.language += 0.3;
  if (input.summary && text.includes(input.summary.slice(0, 4))) dimensions.plot += 0.2;
  if (input.title && text.length > 0) dimensions.plot += 0.1;

  (Object.keys(dimensions) as (keyof Dimensions)[]).forEach((key) => {
    dimensions[key] = clamp(dimensions[key]);
  });

  let score =
    dimensions.plot * WEIGHTS.plot +
    dimensions.character * WEIGHTS.character +
    dimensions.pacing * WEIGHTS.pacing +
    dimensions.language * WEIGHTS.language +
    dimensions.completeness * WEIGHTS.completeness;
  if (hardFail) score = Math.min(score, 5.4);
  score = clamp(score);

  const decision = !hardFail && score >= 5 ? "approve" : "reject";
  const grade = decision === "approve" ? gradeOf(score) : "未过";
  const extra = lowestAdvice(dimensions, input.kind);
  const merged = [...advice, ...extra].filter((item, index, list) => list.indexOf(item) === index).slice(0, 3);
  if (decision === "approve" && merged.length === 0) {
    merged.push("可以上架。若还想再抬一档，把结尾的选择写得更具体。");
  }

  const summary =
    decision === "approve"
      ? `《${input.title}》综合 ${score.toFixed(1)} 分，评级${grade}。${categoryName(input.category)}这一篇能读完，场面和人物基本立住。`
      : `《${input.title}》综合 ${score.toFixed(1)} 分，未通过。${merged[0] ?? "还需要重写后再投。"}`;

  return {
    score,
    grade,
    decision,
    source: "local",
    summary,
    advice: merged,
    dimensions,
  };
}

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON");
  return JSON.parse(text.slice(start, end + 1)) as Partial<Review>;
}

function normalizeModel(data: Partial<Review>, local: Review): Review {
  const dimensions = data.dimensions ?? local.dimensions;
  const keys: (keyof Dimensions)[] = ["plot", "character", "pacing", "language", "completeness"];
  for (const key of keys) {
    const value = Number(dimensions[key]);
    dimensions[key] = clamp(Number.isFinite(value) ? value : local.dimensions[key]);
  }
  const score = clamp(Number(data.score) || local.score);
  const advice = Array.isArray(data.advice)
    ? data.advice.map((item) => String(item)).filter(Boolean).slice(0, 3)
    : local.advice;
  // 起步阶段：分数够就放行，避免模型过严导致库内一篇都没有。
  const decision = score < 5 ? "reject" : "approve";
  return {
    score,
    grade: decision === "approve" ? gradeOf(score) : "未过",
    decision,
    source: "model",
    summary: String(data.summary || local.summary).slice(0, 180),
    advice,
    dimensions,
  };
}

export async function reviewWork(input: ReviewInput): Promise<Review> {
  const local = reviewLocal(input);
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return local;

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  const kindName = input.kind === "script" ? "短剧剧本" : "小说";
  const prompt = [
    `请审核这篇${kindName}，分类是${categoryName(input.category)}。`,
    "只输出一个 JSON 对象，不要写 Markdown。",
    "字段：score（1到10的数字），decision（approve 或 reject），summary（80字以内中文），advice（最多3条中文字符串），dimensions（plot、character、pacing、language、completeness，每个1到10）。",
    "少于200字、明显注水堆字、完全没有场面，才必须 reject。综合低于5分才 reject；满200字且能读完一场的短剧，优先 approve。",
    `标题：${input.title}`,
    `简介：${input.summary}`,
    "正文：",
    input.content.slice(0, 12000),
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
          { role: "system", content: "你是严苛但讲理的中文剧本编辑，只输出 JSON。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return local;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return local;
    return normalizeModel(extractJson(content), local);
  } catch {
    return local;
  }
}
