import { marked } from "marked";
import DOMPurify from "dompurify";
import renderMathInElement from "katex/contrib/auto-render";
import { load, dump, JSON_SCHEMA } from "js-yaml";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

const root = document.querySelector<HTMLElement>("[data-editor]")!;
root.inert = true;
const field = (name: string) =>
  root.querySelector<HTMLInputElement>(`[data-${name}]`)!;
const body = root.querySelector<HTMLTextAreaElement>("[data-markdown]")!;
const preview = root.querySelector<HTMLElement>("[data-preview]")!;
const status = (text: string) => {
  root.querySelector("[data-status]")!.textContent = text;
};
const assets = new Map<string, Uint8Array>();
const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const urls = new Map<string, string>();
let metadata: Record<string, unknown> = {};
let timer: ReturnType<typeof setTimeout>;
const slug = () =>
  field("title")
    .value.trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "") || "note";
const documentText = () =>
  `---\n${dump({ ...metadata, title: field("title").value || "新笔记", course: field("course").value || "Rendering Notes", source: field("source").value, order: typeof metadata.order === "number" ? metadata.order : 0 }, { schema: JSON_SCHEMA })}---\n\n${body.value}`;
const db = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("kiiye-notebook", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("drafts");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
// IndexedDB keeps the image bytes together with the Markdown draft.
async function save() {
  try {
    const database = await db;
    const tx = database.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(
      { text: documentText(), assets: [...assets] },
      "current",
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    status(`已保存到本机 · ${assets.size} 张图片`);
  } catch {
    status("本机存储不可用，请导出发布包保存");
  }
}
function render() {
  preview.innerHTML = DOMPurify.sanitize(
    marked.parse(body.value, { async: false }) as string,
  );
  renderMathInElement(preview, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
    trust: false,
  });
  preview.querySelectorAll("img").forEach((img) => {
    const path = decodePath(img.getAttribute("src") || "");
    if (assets.has(path)) {
      if (!urls.has(path))
        urls.set(
          path,
          URL.createObjectURL(new Blob([assets.get(path)! as BlobPart])),
        );
      img.src = urls.get(path)!;
    }
  });
}
function resetAssets() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
  assets.clear();
}
function importText(text: string) {
  const match = text
    .replace(/^\uFEFF/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const parsed = match ? load(match[1], { schema: JSON_SCHEMA }) : {};
  metadata =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  field("title").value = String(
    metadata.title || text.match(/^#\s+(.+)$/m)?.[1] || "新笔记",
  );
  field("course").value = String(metadata.course || "Rendering Notes");
  field("source").value = String(metadata.source || "");
  body.value = match
    ? text
        .replace(/^\uFEFF/, "")
        .slice(match[0].length)
        .trimStart()
    : text;
}
function changed() {
  render();
  clearTimeout(timer);
  timer = setTimeout(save, 350);
}
function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
root.addEventListener("input", changed);
field("md-input").addEventListener("change", async () => {
  const file = field("md-input").files?.[0];
  if (!file) return;
  try {
    const entries = file.name.endsWith(".zip")
      ? unzipSync(new Uint8Array(await file.arrayBuffer()))
      : null;
    const name = entries
      ? Object.keys(entries).filter((n) => /\.md$/i.test(n))
      : [];
    if (entries && name.length !== 1)
      throw new Error("发布包中需要且只能有一篇 Markdown");
    const text = entries ? strFromU8(entries[name[0]]) : await file.text();
    // Parse first so a malformed import does not destroy the current draft.
    importText(text);
    resetAssets();
    if (entries)
      Object.entries(entries).forEach(([path, bytes]) => {
        if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(path))
          assets.set(path, bytes);
      });
    changed();
    status("文章已导入");
  } catch (error) {
    status(`导入失败：${(error as Error).message}`);
  }
  field("md-input").value = "";
});
field("image-input").addEventListener("change", async () => {
  for (const file of field("image-input").files || []) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .slice(0, 6)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const name = file.name.replace(/[^\p{L}\p{N}._-]/gu, "-");
    // Match relative references in imported MD before inserting a new reference.
    const missing = [...preview.querySelectorAll("img")]
      .map((img) => decodePath(img.getAttribute("src") || ""))
      .filter(
        (src) =>
          !/^(?:https?:|data:|blob:|\/)/.test(src) &&
          src.split("/").pop() === file.name,
      );
    if (missing.length) missing.forEach((path) => assets.set(path, bytes));
    else {
      const path = `images/${hash}-${name}`;
      assets.set(path, bytes);
      body.setRangeText(
        `\n![${name}](${encodeURI(path)})\n`,
        body.selectionStart,
        body.selectionEnd,
        "end",
      );
    }
  }
  field("image-input").value = "";
  changed();
});
root.querySelector("[data-copy]")!.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(documentText());
    status("Markdown 已复制");
  } catch {
    status("无法访问剪贴板，请下载 Markdown");
  }
});
root
  .querySelector("[data-download]")!
  .addEventListener("click", () =>
    download(documentText(), `${slug()}.md`, "text/markdown"),
  );
root.querySelector("[data-export]")!.addEventListener("click", () => {
  const missing = [...preview.querySelectorAll("img")]
    .map((img) => decodePath(img.getAttribute("src") || ""))
    .filter(
      (src) => !/^(?:https?:|data:|blob:|\/)/.test(src) && !assets.has(src),
    );
  if (missing.length) {
    status(`缺少图片附件：${missing.join("、")}，请先添加图片`);
    return;
  }
  const entries: Record<string, Uint8Array> = {
    [`${slug()}.md`]: strToU8(documentText()),
    ...Object.fromEntries(assets),
  };
  download(zipSync(entries) as BlobPart, `${slug()}.zip`, "application/zip");
  status("发布包已导出，包含 Markdown 和图片");
});
root.querySelector("[data-new]")!.addEventListener("click", () => {
  if (!confirm("新建会替换当前草稿。已导出需要保留的内容吗？")) return;
  resetAssets();
  importText("# 新笔记\n");
  changed();
});
async function restore() {
  try {
    const database = await db;
    const record = await new Promise<any>((resolve, reject) => {
      const request = database
        .transaction("drafts")
        .objectStore("drafts")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (record) {
      importText(record.text);
      record.assets.forEach(([path, bytes]: [string, Uint8Array]) =>
        assets.set(path, bytes),
      );
    }
    status(`本机草稿 · ${assets.size} 张图片`);
  } catch {
    status("本机存储不可用，请导出发布包保存");
  }
  render();
  root.inert = false;
}
void restore();
