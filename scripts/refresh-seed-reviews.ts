import { DatabaseSync } from "node:sqlite";
import { reviewLocal } from "../lib/ai";
import { readSeedWorks } from "../lib/seed";

const db = new DatabaseSync("data/moben.sqlite");
const update = db.prepare(
  "UPDATE works SET score = ?, grade = ?, status = ?, review_json = ?, review_source = ? WHERE title = ? AND author_id = (SELECT id FROM users WHERE username = ?)",
);
for (const work of readSeedWorks()) {
  const review = reviewLocal(work);
  update.run(
    review.score,
    review.grade,
    review.decision === "approve" ? "published" : "rejected",
    JSON.stringify(review),
    review.source,
    work.title,
    "大黄书",
  );
  console.log(work.title, review.score.toFixed(1), review.grade, review.advice.join(" | "));
}
