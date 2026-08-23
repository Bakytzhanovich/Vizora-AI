import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

const POSTS_DIR = path.join(process.cwd(), "content/blog");

// "general" is for visa-agnostic content (e.g. "как вести себя на любом
// визовом интервью") — not tied to a specific program. b1b2/f1 have no
// posts yet (launch 2027 Q1 / Q2-Q3) — the category still exists now so
// posts just start appearing under their tab the day the first .md file
// with that category lands, no code changes needed.
export type BlogCategory = "j1" | "b1b2" | "f1" | "general";

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  j1: "Work & Travel (J-1)",
  b1b2: "Туристическая виза (B1/B2)",
  f1: "Учёба в США (F-1)",
  general: "Общее про визы",
};

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: BlogCategory;
  keywords: string[];
  contentHtml: string;
}

function isBlogCategory(value: unknown): value is BlogCategory {
  return value === "j1" || value === "b1b2" || value === "f1" || value === "general";
}

function readPostFile(filename: string): BlogPost {
  const slug = filename.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf8");
  const { data, content } = matter(raw);

  if (!isBlogCategory(data.category)) {
    throw new Error(
      `content/blog/${filename}: invalid or missing "category" in frontmatter (got ${JSON.stringify(
        data.category
      )}). Must be one of: j1, b1b2, f1, general.`
    );
  }

  const contentHtml = remark().use(remarkHtml).processSync(content).toString();

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    category: data.category,
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    contentHtml,
  };
}

function isPostFile(filename: string): boolean {
  return filename.endsWith(".md") && filename.toLowerCase() !== "readme.md";
}

// getPostsByCategory/getPostBySlug/app/sitemap.ts all funnel through this —
// without caching, every one of them re-reads and re-parses (including a
// full remark markdown-to-HTML pass) every .md file on every call. Fine at
// today's post count, but module-level caching costs nothing and avoids
// repeating that work per request as the blog grows. Posts only change via
// a redeploy, which resets this module's state anyway.
let _postsCache: BlogPost[] | null = null;

export function getAllPosts(): BlogPost[] {
  if (_postsCache) return _postsCache;
  if (!fs.existsSync(POSTS_DIR)) return [];
  _postsCache = fs
    .readdirSync(POSTS_DIR)
    .filter(isPostFile)
    .map(readPostFile)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return _postsCache;
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((post) => post.category === category);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter(isPostFile)
    .map((filename) => filename.replace(/\.md$/, ""));
}
