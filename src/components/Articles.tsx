/* eslint-disable @next/next/no-img-element */
import articlesData from "../../data/articles.json";
import FadeUp from "./FadeUp";

interface Article {
  id: number;
  title: string;
  url: string;
  excerpt: string;
  voteup_count: number;
  comment_count: number;
  created: number;
  updated: number;
  thumbnail?: string | null;
}

interface ArticlesData {
  updated_at: string;
  articles: Article[];
}

const data = articlesData as unknown as ArticlesData;
const ZHIHU_URL = "https://www.zhihu.com/people/he-xian-wen-lu-xian-ying";

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function Articles() {
  const articles = data.articles;
  const updatedAt = data.updated_at;
  const isEmpty = !articles || articles.length === 0;

  return (
    <section
      id="articles"
      className="section"
      style={{ borderTop: "1px solid var(--border-light)", paddingBottom: 80 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div className="section-label" style={{ marginBottom: 0, flex: 1 }}>
          Writing
        </div>
        <a
          href={ZHIHU_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="view-all-btn"
        >
          知乎主页
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M7 17L17 7M7 7h10v10" />
          </svg>
        </a>
      </div>

      {updatedAt && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--text-3)",
            marginBottom: 24,
            marginTop: -16,
          }}
        >
          {"synced "} {updatedAt}
        </div>
      )}

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {articles.map((article, i) => (
            <FadeUp key={article.id} delay={i * 50} spring>
              <ArticleRow
                article={article}
                isLast={i === articles.length - 1}
              />
            </FadeUp>
          ))}
        </div>
      )}
    </section>
  );
}

function ArticleRow({
  article,
  isLast,
}: {
  article: Article;
  isLast: boolean;
}) {
  const hasThumbnail = !!article.thumbnail;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="article-row-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border-light)",
        textDecoration: "none",
      }}
    >
      <div
        className="article-thumb"
        style={{
          width: 96,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasThumbnail ? (
          <img
            src={article.thumbnail!}
            alt={article.title}
          />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="article-row-title"
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-1)",
            lineHeight: 1.5,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {article.title}
        </div>
        {article.excerpt && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-3)",
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            {article.excerpt}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--text-3)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {formatNum(article.voteup_count)}
          </span>
          <span>{formatDate(article.created)}</span>
        </div>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        paddingTop: 20,
        fontFamily: "var(--mono)",
        fontSize: 12,
        color: "var(--text-3)",
        lineHeight: 2,
      }}
    >
      <div>{"首次运行 GitHub Actions 后文章将自动同步"}</div>
      <div>
        {"前往 "}
        <a
          href={ZHIHU_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          知乎主页
        </a>{" "}
        {"查看原文"}
      </div>
    </div>
  );
}
