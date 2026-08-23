import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getAllPosts, getPostsByCategory, CATEGORY_LABELS, type BlogCategory, type BlogPost } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Блог",
  description: "Статьи о подготовке к визовому интервью: вопросы консула, типичные причины отказа, чек-листы документов.",
  alternates: { canonical: "/blog" },
};

// Tabs shown now — j1 is the only launched visa type. b1b2/f1 launch in
// 2027 (Q1 / Q2-Q3); their tabs already exist so no UI work is needed when
// the first post with that category lands, see content/blog/README.md.
const TABS: { key: BlogCategory | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "j1", label: "Work & Travel" },
  { key: "b1b2", label: "B1/B2" },
  { key: "f1", label: "F1" },
];

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block bg-[#13131A] border border-[#1E1E2E] hover:border-[#6C63FF]/40 rounded-2xl p-6 transition-colors duration-200"
    >
      <span className="inline-block text-xs font-semibold text-[#9C8BFF] bg-[#6C63FF]/10 border border-[#6C63FF]/30 rounded-full px-3 py-1 mb-4">
        {CATEGORY_LABELS[post.category]}
      </span>
      <h2 className="text-xl font-bold text-[#F0F0FF] mb-2 leading-snug">{post.title}</h2>
      <p className="text-[#8B8BA7] text-sm leading-relaxed mb-4">{post.description}</p>
      <time dateTime={post.date} className="text-xs text-[#8B8BA7]/70">
        {post.date}
      </time>
    </Link>
  );
}

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const activeTab = TABS.some((tab) => tab.key === searchParams.category)
    ? (searchParams.category as BlogCategory | "all")
    : "all";

  const posts = activeTab === "all" ? getAllPosts() : getPostsByCategory(activeTab);
  const isUpcomingCategory = activeTab !== "all" && posts.length === 0;

  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-24">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#F0F0FF] tracking-tight mb-4">
          Блог Vizora AI
        </h1>
        <p className="text-[#8B8BA7] text-lg mb-10 max-w-2xl">
          Разбираем вопросы консула, причины отказов и подготовку к визовому интервью.
        </p>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-10">
          {TABS.map((tab) => {
            const href = tab.key === "all" ? "/blog" : `/blog?category=${tab.key}`;
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? "bg-[#6C63FF] text-white"
                    : "bg-[#13131A] border border-[#1E1E2E] text-[#8B8BA7] hover:text-[#F0F0FF]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {isUpcomingCategory ? (
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-10 text-center">
            <p className="text-[#F0F0FF] font-semibold mb-2">Скоро появится</p>
            <p className="text-[#8B8BA7] text-sm">
              Направление {CATEGORY_LABELS[activeTab as BlogCategory]} ещё не запущено — статьи
              появятся здесь автоматически.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-[#8B8BA7]">Пока нет статей.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
