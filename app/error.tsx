"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap page">
      <h1>这一页没有打开</h1>
      <button className="btn solid" type="button" onClick={() => reset()}>
        再试一次
      </button>
    </div>
  );
}
