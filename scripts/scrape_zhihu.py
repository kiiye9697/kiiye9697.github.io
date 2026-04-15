#!/usr/bin/env python3
"""
知乎文章爬虫
抓取 https://www.zhihu.com/people/he-xian-wen-lu-xian-ying 的全部文章，
写入 data/articles.json。

依赖：pip install requests
环境变量：ZHIHU_COOKIE  （必须）
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

USER_URL_TOKEN = "he-xian-wen-lu-xian-ying"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "articles.json")
API_BASE = "https://www.zhihu.com/api/v4"
LIMIT = 20


def get_headers() -> dict:
    cookie = os.environ.get("ZHIHU_COOKIE", "")
    if not cookie:
        print("警告: 未设置 ZHIHU_COOKIE 环境变量，请求可能被拒绝。", file=sys.stderr)
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Cookie": cookie,
        "Referer": f"https://www.zhihu.com/people/{USER_URL_TOKEN}/posts",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "x-requested-with": "fetch",
    }


def fetch_articles(offset: int = 0) -> dict:
    params = {
        "include": (
            "data[*].comment_count,suggest_edit,is_normal,thumbnail_extra_info,"
            "thumbnail,can_comment,comment_permission,content,voteup_count,"
            "created,updated,upvoted_followees,voting,review_info,is_labeled,label_info"
        ),
        "offset": offset,
        "limit": LIMIT,
        "sort_by": "created",
    }
    url = f"{API_BASE}/members/{USER_URL_TOKEN}/articles"
    resp = requests.get(url, headers=get_headers(), params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_thumbnail(raw: dict) -> str | None:
    """按优先级提取文章封面图 URL。"""
    # 1. thumbnail_extra_info.thumbnail
    t = raw.get("thumbnail_extra_info") or {}
    if isinstance(t, dict):
        url = t.get("thumbnail") or t.get("url") or ""
        if isinstance(url, str) and url.startswith("http"):
            return url

    # 2. 顶层 thumbnail 字段
    thumb = raw.get("thumbnail")
    if isinstance(thumb, str) and thumb.startswith("http"):
        return thumb
    if isinstance(thumb, dict):
        url = thumb.get("url") or thumb.get("thumbnail") or ""
        if isinstance(url, str) and url.startswith("http"):
            return url

    # 3. 从正文 HTML 中提取第一张 <img> 的 src
    content = raw.get("content", "") or ""
    import re as _re
    m = _re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content)
    if m:
        src = m.group(1)
        if src.startswith("http"):
            return src

    return None


def parse_article(raw: dict) -> dict:
    """从 API 返回的原始数据中提取需要的字段。"""
    import re
    content = raw.get("content", "") or ""
    # 纯文本摘要
    excerpt = re.sub(r"<[^>]+>", "", content)
    excerpt = " ".join(excerpt.split())[:200]

    thumbnail = extract_thumbnail(raw)

    return {
        "id": raw.get("id"),
        "title": raw.get("title", "").strip(),
        "url": f"https://zhuanlan.zhihu.com/p/{raw.get('id')}",
        "excerpt": excerpt,
        "voteup_count": raw.get("voteup_count", 0),
        "comment_count": raw.get("comment_count", 0),
        "created": raw.get("created", 0),
        "updated": raw.get("updated", 0),
        "thumbnail": thumbnail,
    }


def scrape_all() -> list:
    articles = []
    offset = 0
    print(f"开始抓取 {USER_URL_TOKEN} 的文章...")

    while True:
        try:
            data = fetch_articles(offset)
        except requests.HTTPError as e:
            print(f"请求失败 (offset={offset}): {e}", file=sys.stderr)
            break
        except Exception as e:
            print(f"未知错误: {e}", file=sys.stderr)
            break

        items = data.get("data", [])
        if not items:
            break

        for item in items:
            articles.append(parse_article(item))
            print(f"  [{len(articles)}] {item.get('title', '')[:60]}")

        paging = data.get("paging", {})
        if paging.get("is_end") or not items:
            break

        offset += LIMIT
        time.sleep(1.5)  # 礼貌性延迟

    print(f"\n共抓取 {len(articles)} 篇文章。")
    return articles


def main():
    articles = scrape_all()

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "articles": articles,
    }

    out_path = os.path.abspath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"已写入 {out_path}")

    if not articles:
        print("警告: 未抓取到任何文章，请检查 ZHIHU_COOKIE 是否有效。", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
