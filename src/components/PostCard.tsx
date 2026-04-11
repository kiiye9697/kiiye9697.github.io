/* eslint-disable @next/next/no-img-element */
type Post = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  voteup_count: number;
  comment_count: number;
  created: number;
  thumbnail?: string | null;
};

type PostCardProps = {
  post: Post;
};

function formatDate(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className="surface-card post-card group block overflow-hidden rounded-[28px]"
    >
      <div className="post-cover aspect-[16/10] border-b border-white/8 bg-[var(--panel-strong)]">
        {post.thumbnail ? (
          <img
            src={post.thumbnail}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(200,16,46,0.32),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(46,139,87,0.28),transparent_50%),rgba(255,255,255,0.03)] text-sm uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Zhihu Post
          </div>
        )}
      </div>
      <div className="p-6">
        <div className="card-index">Post</div>
        <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">
          <span>{formatDate(post.created)}</span>
          <span>Zhihu</span>
        </div>
        <h3 className="mt-4 line-clamp-2 text-xl font-semibold tracking-tight text-[var(--text-main)]">
          {post.title}
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--text-muted)]">
          {post.excerpt}
        </p>
        <div className="mt-5 flex items-center gap-5 text-sm text-[var(--text-subtle)]">
          <span>Likes {formatCount(post.voteup_count)}</span>
          <span>Comments {formatCount(post.comment_count)}</span>
        </div>
      </div>
    </a>
  );
}
