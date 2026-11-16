import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkCard } from "@/components/WorkCard";
import { categoryBlurb, categoryName, isCategory } from "@/lib/categories";
import { listWorks } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) return { title: "未找到" };
  return { title: categoryName(slug), description: categoryBlurb(slug) };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCategory(slug)) notFound();
  const works = listWorks({ category: slug });

  return (
    <div className="wrap page">
      <p className="kicker">分类</p>
      <h1>{categoryName(slug)}</h1>
      <p className="intro">{categoryBlurb(slug)}</p>
      {works.length === 0 ? (
        <p className="empty">这一类还没有上架的稿。你可以成为第一篇。</p>
      ) : (
        <div className="cards cols" style={{ marginTop: 16 }}>
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </div>
  );
}
