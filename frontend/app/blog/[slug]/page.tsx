import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getAllSlugs, getPostBySlug, CATEGORY_LABELS, type BlogCategory } from "@/lib/blog";

// One emoji per category, purely decorative — matches the ticket's example
// badge ("🎓 Work & Travel (J-1)"). general has no specific visa icon so it
// gets a neutral one.
const CATEGORY_EMOJI: Record<BlogCategory, string> = {
  j1: "🎓",
  b1b2: "✈️",
  f1: "📚",
  general: "🛂",
};

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <article className="max-w-3xl mx-auto px-4 pt-32 pb-24">
        <Link href="/blog" className="text-sm text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors duration-200">
          ← Все статьи
        </Link>

        <div className="mt-6 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9C8BFF] bg-[#6C63FF]/10 border border-[#6C63FF]/30 rounded-full px-3 py-1">
            {CATEGORY_EMOJI[post.category]} {CATEGORY_LABELS[post.category]}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#F0F0FF] tracking-tight leading-tight mb-3">
          {post.title}
        </h1>
        <time dateTime={post.date} className="text-sm text-[#8B8BA7]/70">
          {post.date}
        </time>

        <div
          className="prose prose-invert prose-headings:text-[#F0F0FF] prose-p:text-[#B8B8D0] prose-li:text-[#B8B8D0] prose-strong:text-[#F0F0FF] max-w-none mt-8"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
      <Footer />
    </main>
  );
}
