import { test, expect } from "@playwright/test";
test("glass cabinet rotates, keyboard selects and focus returns from expanded exhibit", async ({ page }) => {
  await page.goto("/");
  const cabinet = page.locator(".glass-cabinet");
  await expect(page.locator("[data-glass-showcase]")).toHaveClass(/is-ready/);
  const initial = await cabinet.getAttribute("style");
  await page.getByRole("button", { name: "下一件展品" }).click();
  await expect(page.locator("#glass-tab-1")).toHaveAttribute("aria-selected", "true");
  expect(await cabinet.getAttribute("style")).not.toBe(initial);
  await page.locator("#glass-tab-1").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#glass-tab-2")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator("#glass-tab-0")).toHaveAttribute("aria-selected", "true");
  const open = page.getByRole("button", { name: "展开安菲尔德体育场", exact: true });
  await page.waitForTimeout(800); // Wait for the user-visible cabinet rotation to settle.
  await open.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭展品" })).toBeFocused();
  await expect(page.getByRole("dialog")).toContainText("待收录");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
test("mobile cabinet contains overflow and reserved exhibit closes on backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "下一件展品" }).click();
  await page.getByRole("button", { name: "展开上古卷轴：天际", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("待收录");
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("without JavaScript all three gallery exhibits remain visible", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4321/");
  await expect(page.locator(".glass-panel")).toHaveCount(3);
  for (const panel of await page.locator(".glass-panel").all()) await expect(panel).toBeVisible();
  await expect(page.locator(".glass-controls")).toBeHidden();
  await expect(page.getByRole("link", { name: "地点与游戏画廊" })).toBeVisible();
  await context.close();
});






