import { test, expect, type Page } from "@playwright/test";

const activeVideo = (page: Page) => page.locator(".vortex-slot.is-active video");

test("each experiment can be selected on entry and rendered without a frame", async ({ browser }) => {
  for (const [seed, id, title] of [[0, "smoke", "TURBULENT PLUME"], [.4, "collision", "VORTEX COLLISION"], [.8, "leapfrog", "VORTEX LEAPFROGGING"]] as const) {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(value => { Math.random = () => value; }, seed);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("[data-vortex]")).toHaveAttribute("data-experiment", id);
    await expect(page.locator("[data-experiment-title]")).toHaveText(title);
    await expect(page.locator("[data-experiment-roll]")).toBeEnabled();
    await page.locator(".vortex-slot.is-active img").evaluate((image: HTMLImageElement) => image.decode());
    await expect(page.locator(".vortex-slot video[src]")).toHaveCount(0);
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["small", 320, 740]] as const) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `../../outputs/experiment-final-${id}-${name}.png` });
    }
    await context.close();
  }
});

test("roll changes experiment, serializes rapid clicks and preserves manual pause", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/");
  const root = page.locator("[data-vortex]");
  const roll = page.locator("[data-experiment-roll]");
  await expect(roll).toBeEnabled();
  await roll.evaluate(button => { for (let i = 0; i < 15; i++) button.dispatchEvent(new MouseEvent("click")); });
  await expect(root).toHaveAttribute("data-experiment", "collision");
  await expect(roll).toBeEnabled();
  await expect(page.locator(".vortex-slot video[src]")).toHaveCount(0);
  await page.getByRole("button", { name: "播放实验影像", exact: true }).click();
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await expect(activeVideo(page)).toHaveAttribute("src", "/media/experiment-collision.mp4");
  await page.getByRole("button", { name: "暂停实验影像", exact: true }).click();
  await roll.click();
  await expect(root).toHaveAttribute("data-experiment", "leapfrog");
  await expect(roll).toBeEnabled();
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.locator(".home-closing").scrollIntoViewIfNeeded();
  await root.scrollIntoViewIfNeeded();
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

test("only selected movie autoplays, pauses offscreen and renders actual frames", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", request => { if (request.url().endsWith(".mp4")) requested.push(request.url()); });
  await page.addInitScript(() => { Math.random = () => .4; });
  await page.goto("/");
  await expect(page.locator("[data-vortex]")).toHaveAttribute("data-experiment", "collision");
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(.2);
  expect(requested.every(url => url.endsWith("experiment-collision.mp4"))).toBe(true);
  await expect(page.locator(".vortex-slot.is-active")).toHaveClass(/has-frame/);
  await page.screenshot({ path: "../../outputs/experiment-final-collision-playing.png" });
  await page.locator(".home-closing").scrollIntoViewIfNeeded();
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.locator("[data-vortex]").scrollIntoViewIfNeeded();
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await page.getByRole("button", { name: "暂停实验影像", exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => activeVideo(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

test("save-data avoids movie loading and no-JavaScript retains a named poster", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => { Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } }); Math.random = () => .8; });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("[data-vortex]")).toHaveAttribute("data-experiment", "leapfrog");
  await expect(page.locator(".vortex-slot video[src]")).toHaveCount(0);
  await context.close();
  const fallback = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await fallback.newPage();
  await nojs.goto("/");
  await expect(nojs.locator("[data-experiment-title]")).toHaveText("TURBULENT PLUME");
  await expect(nojs.locator(".vortex-slot.is-active img")).toBeVisible();
  await expect(nojs.locator("[data-experiment-controls]")).toBeHidden();
  await fallback.close();
});

test("failed next poster keeps the current experiment visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.route("**/experiment-collision-poster.png", route => route.abort());
  await page.goto("/");
  await page.locator("[data-experiment-roll]").click();
  await expect(page.locator("[data-experiment-status]")).toContainText("暂时无法载入");
  await expect(page.locator("[data-vortex]")).toHaveAttribute("data-experiment", "smoke");
  await expect(page.locator(".vortex-slot.is-active img")).toBeVisible();
});

