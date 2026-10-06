import { test, expect } from "@playwright/test";

test("gallery routes retain real content and work at narrow widths", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/portfolio/",
    "/projects/",
    "/projects/classic-sponza-urp/",
    "/projects/sdf-baker/",
  ]) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('main img[src$=".svg"]')).toHaveCount(0);
  }
  await page.goto("/projects/");
  await expect(page.locator(".gallery-study")).toHaveCount(5);
  await expect(page.locator(".gallery-upcoming a")).toHaveCount(0);
  await page.getByRole("link", { name: /SDF Baker/ }).click();
  await expect(page.locator("h1")).toContainText("SDF Baker");
  await expect(page.locator("main")).not.toContainText("Classic Sponza");
});

test("gallery has visible content and usable links without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4321/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".home-intro h1")).toContainText("孙浩然");
  await expect(page.locator("#experience h2")).toBeVisible();
  await expect(page.locator("#gallery h2")).toBeVisible();
  await expect(page.locator(".home-intro .vortex-slot.is-active .vortex-poster")).toBeVisible();
  await expect(page.locator(".home-intro .vortex-slot.is-active .vortex-poster")).toHaveJSProperty("naturalWidth", 640);
  await expect(page.locator("[data-experiment-title]")).toHaveText("TURBULENT PLUME");
  await expect(page.locator("[data-experiment-roll]")).toBeHidden();
  await page.locator('.home-intro-links a[href="#gallery"]').click();
  await expect(page).toHaveURL(/#gallery$/);
  await page.locator('.nav-links a[href="/portfolio/"]').click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.locator("h1")).toBeVisible();
  await context.close();
});

