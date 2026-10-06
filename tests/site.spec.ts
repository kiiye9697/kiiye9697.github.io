import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import { execFileSync } from "node:child_process";

const output = path.resolve("../../outputs");
test("homepage desktop/mobile, motion and navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
    ["small", 320, 740],
    ["wide", 1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".home-intro h1")).toContainText("孙浩然");
    await expect(page.locator(".home-intro")).toContainText("技术美术");
    await expect(page.locator(".home-intro")).not.toContainText("SDF Baker");
    await expect(page.locator(".anthem-track")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const sections = await page.locator(".home-editorial > section").evaluateAll(elements =>
      elements.map(element => element.id || element.className));
    expect(sections).toEqual(["home-intro", "experience", "gallery", "articles"]);
    const poster = page.locator(".home-intro .vortex-slot.is-active .vortex-poster");
    await expect(poster).toHaveAttribute("src", /\/media\/experiment-.+-poster\.png$/);
    expect(await poster.evaluate(async (element: HTMLImageElement) => {
      await element.decode();
      return element.naturalWidth;
    })).toBeGreaterThan(0);
    await expect(page.locator("[data-experiment-title]")).toHaveText(/^(TURBULENT PLUME|VORTEX COLLISION|VORTEX LEAPFROGGING)$/);
    await expect(page.locator("[data-experiment-roll]")).toBeVisible();
    await page.locator(".home-closing").scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(1100);
    await fs.mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, `gallery-${name}.png`),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".home-intro h1")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.locator('.home-intro-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  expect(errors).toEqual([]);
});

test("editor image persistence, safe Markdown and portable publish package", async ({
  page,
}) => {
  await page.goto("/editor/");
  await expect(page.locator("[data-status]")).toContainText("本机草稿");
  await page.locator("[data-title]").fill("Publication Check");
  await page.locator("[data-course]").fill("TA Experiments");
  await page
    .locator("[data-markdown]")
    .fill(
      "# Publication Check\n\n| A | B |\n|---|---|\n|1|2|\n\n<script>window.bad=1</script>\n\n[x](javascript:alert(1))\n",
    );
  await page
    .locator("[data-image-input]")
    .setInputFiles(path.resolve("public/background1.jpg"));
  await expect(page.locator("[data-preview] img")).toHaveJSProperty(
    "naturalWidth",
    1440,
  );
  await expect(page.locator("[data-preview] table")).toBeVisible();
  expect(await page.locator("[data-preview] script").count()).toBe(0);
  await expect(page.locator("[data-status]")).toContainText("1 张图片");
  await page.reload();
  await expect(page.locator("[data-title]")).toHaveValue("Publication Check");
  await expect(page.locator("[data-preview] img")).toHaveJSProperty(
    "naturalWidth",
    1440,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-export]").click();
  const download = await downloadPromise;
  const archive = await fs.readFile((await download.path())!);
  const entries = unzipSync(archive);
  expect(
    Object.keys(entries).filter((p) => p.startsWith("images/")).length,
  ).toBe(1);
  expect(strFromU8(entries["publication-check.md"])).toContain(
    "TA Experiments",
  );
  await page.locator("[data-md-input]").setInputFiles({
    name: "roundtrip.zip",
    mimeType: "application/zip",
    buffer: archive,
  });
  await expect(page.locator("[data-preview] img")).toHaveJSProperty(
    "naturalWidth",
    1440,
  );
  await page
    .locator("[data-markdown]")
    .fill(
      "# 渲染实验手记\n\n## 屏幕空间反射\n\n记录一次 URP 渲染管线的实验。\n\n- 观察材质粗糙度与反射的关系\n- 对比时域累积前后的噪声\n\n" +
        strFromU8(entries["publication-check.md"]).match(
          /!\[[^\]]*\]\([^)]+\)/,
        )![0],
    );
  await page.locator("[data-title]").fill("渲染实验手记");
  const current = await page.locator("[data-markdown]").inputValue();
  await page.locator("[data-markdown]").fill(current + "\n\n$E = mc^2$\n");
  await expect(page.locator("[data-preview] .katex")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bounds = await page.evaluate(() => ({
    preview: document.querySelector("[data-preview]")!.getBoundingClientRect()
      .bottom,
    footer: document.querySelector(".site-footer")!.getBoundingClientRect().top,
  }));
  expect(bounds.preview).toBeLessThan(bounds.footer);
  await page.screenshot({
    path: path.join(output, "editor-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(output, "editor-mobile.png"),
    fullPage: true,
  });
});

test("notes search and categories", async ({ page }) => {
  await page.goto("/writing/");
  await page.locator("[data-note-search]").fill("GTAO");
  await expect(page.locator("[data-note-title]:visible")).toHaveCount(1);
  await page
    .locator("[data-note-category]")
    .selectOption("GAMES101 现代计算机图形学入门作业");
  await expect(page.locator("[data-no-results]")).toBeVisible();
  await page.locator("[data-note-search]").fill("");
  await expect(page.locator("[data-note-group]:visible")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("remote image failure uses site-local backup", async ({ page }) => {
  await page.route(
    "https://kiiyeblog.oss-cn-beijing.aliyuncs.com/notes/**",
    (r) => r.abort(),
  );
  await page.route("http://127.0.0.1:4321/notes/check.jpg", (r) =>
    r.fulfill({
      path: path.resolve("public/background1.jpg"),
      contentType: "image/jpeg",
    }),
  );
  await page.route("http://127.0.0.1:4321/", async (r) => {
    const response = await r.fetch();
    await r.fulfill({
      response,
      body: (await response.text()).replace(
        "</main>",
        '<img id="fallback-probe" src="https://kiiyeblog.oss-cn-beijing.aliyuncs.com/notes/check.jpg" alt="test" /></main>',
      ),
    });
  });
  await page.goto("/");
  await expect(page.locator("#fallback-probe")).toHaveAttribute(
    "src",
    "/notes/check.jpg",
  );
  await expect(page.locator("#fallback-probe")).toHaveJSProperty(
    "naturalWidth",
    1440,
  );
});

test("publisher validates assets and builds local article without overwriting", async () => {
  test.setTimeout(120000);
  const slug = `publish-check-${Date.now()}`;
  const archive = path.resolve(`tests/${slug}.zip`);
  const article = path.resolve(`src/content/writing/${slug}.md`);
  const images = path.resolve(`public/notes/${slug}`);
  const run = (...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        "scripts/publish-note.mjs",
        archive,
        "--slug",
        slug,
        "--local-only",
        ...args,
      ],
      { encoding: "utf8" },
    );
  try {
    const md =
      "---\ntitle: Test\ncourse: Testing\n---\n\n# Test\n\n![Image](images/test.jpg)\n\n$$\nx^2\n$$\n";
    await fs.writeFile(archive, zipSync({ "article.md": strToU8(md) }));
    expect(() => run("--dry-run")).toThrow();
    await fs.writeFile(
      archive,
      zipSync({
        "article.md": strToU8(md),
        "images/test.jpg": await fs.readFile("public/background1.jpg"),
      }),
    );
    expect(run("--dry-run")).toContain("Images: 1");
    await expect(fs.access(article)).rejects.toThrow();
    expect(run()).toContain("not pushed");
    const content = await fs.readFile(article, "utf8");
    expect(content).toContain(`/notes/${slug}/`);
    expect(content).toContain("$$");
    expect((await fs.readdir(images)).length).toBe(1);
    expect(() => run()).toThrow();
    expect(await fs.readFile(article, "utf8")).toBe(content);
    await fs.writeFile(
      archive,
      zipSync({
        "article.md": strToU8(
          md.replace("course: Testing", "course: Testing\nsource: {}"),
        ),
        "images/test.jpg": await fs.readFile("public/background1.jpg"),
      }),
    );
    expect(() => run("--overwrite")).toThrow();
    expect(await fs.readFile(article, "utf8")).toBe(content);
  } finally {
    await fs.rm(archive, { force: true });
    await fs.rm(article, { force: true });
    // Both paths are unique fixtures created by this test inside the repository.
    await fs.rm(images, { recursive: true, force: true });
    await fs.rm(path.resolve(`dist/writing/${slug}`), {
      recursive: true,
      force: true,
    });
  }
});
