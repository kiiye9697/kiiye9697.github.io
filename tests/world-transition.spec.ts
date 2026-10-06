import { test, expect } from "@playwright/test";
import path from "node:path";

test("real page snapshots use reproducible Bezier film cuts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    let started = 0;
    addEventListener('pagereveal', () => { started = performance.now(); });
    Element.prototype.animate = function (frames, options) {
      const animation = original.call(this, frames, options);
      if (
        typeof options === "object" &&
        options.pseudoElement === "::view-transition-old(root)"
      ) {
        animation.pause();
        (window as any).dissolveTest = { animation, frames, maskCost: performance.now() - started };
      }
      return animation;
    };
  });
  const hashes: string[] = [];
  for (const [width, height, seed] of [
    [1440, 1000, 0],
    [1440, 1000, 1],
    [1440, 1000, 0],
    [390, 844, 2],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/?seed=${seed}`);
    await expect(page.locator(".world-transition")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main h1")).toBeVisible();
    await page.locator('.nav-links a[href="/writing/"]').click();
    await page.waitForFunction(() => Boolean((window as any).dissolveTest));
    const result = await page.evaluate(async () => {
      const frames = (window as any).dissolveTest.frames;
      const values = [];
      for (const index of [0, 10, 20, 30, 40]) {
        const image = new Image();
        image.src = frames[index].maskImage.slice(5, -2);
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        let visible = 0,
          color = 0;
        for (let i = 0; i < data.length; i += 4) {
          visible += data[i + 3] === 255 ? 1 : 0;
          color += data[i] + data[i + 1] + data[i + 2];
        }
        values.push({ coverage: visible / (data.length / 4), color });
      }
      return { values, middle: frames[20].maskImage, maskCost: (window as any).dissolveTest.maskCost, holds: frames.filter((frame: any, i: number) => i > 0 && frame.maskImage === frames[i - 1].maskImage && frame.transform === frames[i - 1].transform).length };
    });
    expect(result.values[0].coverage).toBe(1);
    expect(result.values[1].coverage).toBeGreaterThan(0.8);
    expect(result.values[2].coverage).toBeGreaterThan(0.2);
    expect(result.values[2].coverage).toBeLessThan(0.8);
    expect(result.values[3].coverage).toBeLessThan(0.2);
    expect(result.values[4].coverage).toBe(0);
    expect(result.values.every((v) => v.color === 0)).toBe(true);
    expect(result.holds).toBeGreaterThanOrEqual(4);
    console.log(`mask setup ${width}×${height}: ${result.maskCost.toFixed(1)} ms`);
    hashes.push(result.middle);
    for (const time of [0, 180, 360, 540, 720]) {
      await page.evaluate((time) => {
        (window as any).dissolveTest.animation.currentTime = time;
      }, time);
      await page.screenshot({
        path: path.resolve(
          `../../outputs/stylized-transition-${width}-${seed}-${time}.png`,
        ),
      });
    }
    await page.evaluate(() => (window as any).dissolveTest.animation.finish());
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-transition",
      "film-cut",
    );
  }
  expect(hashes[0]).toBe(hashes[2]);
  expect(hashes[0]).not.toBe(hashes[1]);
  expect(errors).toEqual([]);
});

test("native links, back, downloads and reduced motion remain intact", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await page.locator('.home-intro-links a[href="#gallery"]').click();
  await expect(page).toHaveURL(/#gallery$/);
  await page.locator('.nav-links a[href="/portfolio/"]').click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-world-seed", "1");
  await page.goBack();
  const pending = page.waitForEvent("download");
  await page.locator(".nav-actions").getByRole("link", { name: "下载简历", exact: true }).click();
  expect((await pending).suggestedFilename()).toBe("Sun-Haoran-Resume.pdf");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('.nav-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-transition",
    "film-cut",
  );
});




test("native navigation works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await page.locator('.nav-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator('main')).toBeVisible();
  await context.close();
});

test("unavailable View Transition falls back to native navigation", async ({ page }) => {
  await page.addInitScript(() => {
    addEventListener('pagereveal', (event: any) => {
      event.viewTransition?.skipTransition();
      Object.defineProperty(event, 'viewTransition', { value: undefined });
    });
  });
  await page.goto('/?seed=0');
  await page.locator('.nav-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-transition');
});

test("natural transition finishes and releases snapshot animations", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (typeof options === 'object' && options.pseudoElement === '::view-transition-old(root)') {
        (window as any).nativeFilmStarted = true;
      }
      return original.call(this, frames, options);
    };
  });
  await page.goto('http://127.0.0.1:4321/?seed=0');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.nav-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await page.waitForFunction(() => (window as any).nativeFilmStarted);
  await expect(page.locator('html')).not.toHaveAttribute('data-transition');
  expect(await page.evaluate(() => document.getAnimations().filter((animation) =>
    (animation.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-old(root)').length)).toBe(0);
  await page.locator('.nav-links a[href="/"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-transition');
  await context.close();
});
