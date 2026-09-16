import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { unzipSync, strFromU8 } from "fflate";
import { load, dump, JSON_SCHEMA } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    slug: { type: "string" },
    overwrite: { type: "boolean" },
    push: { type: "boolean" },
    "local-only": { type: "boolean" },
    "dry-run": { type: "boolean" },
    help: { type: "boolean" },
  },
});
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const originals = new Map();
let committed = false;
let uploadCount = 0;

function parseDocument(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const data = match ? load(match[1], { schema: JSON_SCHEMA }) : {};
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Frontmatter must be a mapping.");
  const content = match ? clean.slice(match[0].length) : clean;
  return {
    data: {
      ...data,
      title: data.title || content.match(/^#\s+(.+)$/m)?.[1],
      course: data.course || "Rendering Notes",
      order: data.order ?? 0,
    },
    content,
  };
}
async function write(file, bytes) {
  originals.set(
    file,
    await fs.readFile(file).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    }),
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}
async function main() {
  if (values.help || !positionals[0]) {
    console.log(
      "npm run note:publish -- <article.md|package.zip> [--slug name] [--overwrite] [--push] [--local-only] [--dry-run]",
    );
    return;
  }
  const input = path.resolve(positionals[0]);
  const config = JSON.parse(
    await fs.readFile(path.join(repo, "src/lib/image-host.json"), "utf8"),
  );
  const bytes = await fs.readFile(input);
  const entries = /\.zip$/i.test(input) ? unzipSync(bytes) : null;
  const markdown = entries
    ? Object.keys(entries).filter((name) => /\.md$/i.test(name))
    : [path.basename(input)];
  if (markdown.length !== 1)
    throw new Error("Package must contain exactly one Markdown file.");
  const { data, content } = parseDocument(
    entries ? strFromU8(entries[markdown[0]]) : bytes.toString("utf8"),
  );
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    typeof data.course !== "string" ||
    typeof data.order !== "number"
  )
    throw new Error("Title, course and order are invalid.");
  const slug =
    values.slug ||
    path
      .basename(markdown[0], path.extname(markdown[0]))
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
  if (!slug || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(slug))
    throw new Error("Slug may contain letters, numbers and hyphens only.");
  const destination = path.join(repo, "src/content/writing", `${slug}.md`);
  const exists = await fs.access(destination).then(
    () => true,
    () => false,
  );
  if (exists && !values.overwrite)
    throw new Error("Article already exists; use --overwrite to update it.");

  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkStringify);
  const tree = processor.parse(content);
  const referenced = new Set();
  visit(tree, "imageReference", (node) => referenced.add(node.identifier));
  const images = [];
  visit(tree, (node) => {
    if (
      node.type === "image" ||
      (node.type === "definition" && referenced.has(node.identifier))
    )
      images.push(node);
  });
  const files = new Map();
  const rewrites = [];
  for (const node of images) {
    if (/^https?:\/\//i.test(node.url)) continue;
    if (node.url.startsWith("/")) {
      const local = path.resolve(
        repo,
        "public",
        "." + decodeURIComponent(node.url),
      );
      const publicRoot = path.join(repo, "public") + path.sep;
      if (!local.startsWith(publicRoot))
        throw new Error("Invalid public image path.");
      await fs.access(local);
      continue;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(node.url))
      throw new Error("Export images as files before publishing.");
    const relative = decodeURIComponent(node.url.split(/[?#]/)[0]);
    const ext = path.extname(relative).toLowerCase();
    if (
      ![".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"].includes(ext)
    )
      throw new Error(`Unsupported image: ${relative}`);
    let image;
    if (entries) {
      const key = path.posix.normalize(
        path.posix.join(path.posix.dirname(markdown[0]), relative),
      );
      image = entries[key];
      if (!image) throw new Error(`Missing image in package: ${key}`);
    } else {
      image = await fs.readFile(path.resolve(path.dirname(input), relative));
    }
    const hash = createHash("sha256").update(image).digest("hex").slice(0, 20);
    const filename = `${hash}${ext}`;
    files.set(filename, image);
    rewrites.push({ node, filename });
  }
  console.log(
    `Article: ${slug}\nCategory: ${data.course}\nImages: ${files.size}\nMode: ${values.push ? "build, commit and push" : "local import and build"}`,
  );
  if (values["dry-run"]) return;
  if (values.push) {
    if (git("status", "--porcelain"))
      throw new Error(
        "Commit or stash existing changes before --push. Local import works without --push.",
      );
    git("pull", "--ff-only");
    // Pull may introduce the destination; never overwrite it silently.
    if (
      !values.overwrite &&
      (await fs.access(destination).then(
        () => true,
        () => false,
      ))
    )
      throw new Error("Article now exists after pull; use --overwrite.");
  }
  let client;
  if (
    !values["local-only"] &&
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET
  ) {
    const { default: OSS } = await import("ali-oss");
    client = new OSS({
      bucket: config.bucket,
      region: config.region,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      secure: true,
      timeout: 15000,
    });
  }
  const remote = new Set();
  for (const [filename, image] of files) {
    if (client) {
      try {
        await client.put(`notes/${slug}/${filename}`, Buffer.from(image));
        remote.add(filename);
        uploadCount++;
      } catch {
        console.warn(`Upload failed: ${filename}; using site-local backup.`);
      }
    }
    await write(path.join(repo, "public/notes", slug, filename), image);
  }
  for (const { node, filename } of rewrites)
    node.url = `${remote.has(filename) ? config.remoteBase : config.localBase}${encodeURIComponent(slug)}/${filename}`;
  const output = `---\n${dump(data, { schema: JSON_SCHEMA })}---\n\n${processor.stringify(tree)}`;
  await write(destination, output);
  execFileSync(
    process.execPath,
    [path.join(repo, "node_modules/astro/astro.js"), "build"],
    { cwd: repo, stdio: "inherit" },
  );
  if (values.push) {
    const changed = [...originals.keys()].map((file) =>
      path.relative(repo, file).replaceAll("\\", "/"),
    );
    git("add", "--", ...changed);
    if (git("diff", "--cached", "--name-only")) {
      git("commit", "-m", `notes: ${data.title}`);
      committed = true;
    }
    git("push");
  }
  console.log(
    `Done: /writing/${slug}/ | ${files.size} local images | ${uploadCount} uploaded${values.push ? " | pushed" : " | not pushed"}`,
  );
}
main().catch(async (error) => {
  if (!committed) {
    if (values.push && originals.size) {
      try {
        git(
          "restore",
          "--staged",
          "--",
          ...[...originals.keys()].map((f) => path.relative(repo, f)),
        );
      } catch {
        /* No staged changes if build failed. */
      }
    }
    for (const [file, original] of originals) {
      if (original === null) await fs.rm(file, { force: true });
      else await fs.writeFile(file, original);
    }
  }
  console.error(
    `Publish failed: ${error.message}${committed ? "\nLocal commit retained. Retry with git push." : "\nLocal file changes from this run were rolled back."}${uploadCount ? "\nUploaded image objects are retained." : ""}`,
  );
  process.exitCode = 1;
});
