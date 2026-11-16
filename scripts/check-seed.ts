import fs from "node:fs";
import path from "node:path";
import { reviewLocal } from "../lib/ai";
import { readSeedWorks } from "../lib/seed";
import { previewMarkdown } from "../lib/format";

const works = readSeedWorks();
let failed = 0;
for (const work of works) {
  const review = reviewLocal(work);
  const preview = previewMarkdown(work.content);
  const tail = work.content.replace(/\s+/g, "").slice(-24);
  const leaked = work.price > 0 && preview.replace(/\s+/g, "").includes(tail);
  console.log(
    `${work.file}  ${review.score.toFixed(1)} ${review.grade} ${review.decision}  ${work.content.length}字 预览${preview.length}`,
  );
  if (review.decision !== "approve" || leaked) {
    failed += 1;
    console.log(review.summary);
    console.log(review.advice.join(" / "));
  }
}
if (!fs.existsSync(path.join(process.cwd(), "content", "seed"))) failed += 1;
if (failed > 0) process.exitCode = 1;
