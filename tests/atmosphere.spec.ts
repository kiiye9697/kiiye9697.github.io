import { test, expect } from "@playwright/test";
import path from "node:path";

test("visit time sets bounded glass material without changing during the visit", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "Asia/Shanghai",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const materials: number[] = [];
  for (const [hour, phase] of [
    ["02", "night"],
    ["08", "morning"],
    ["13", "day"],
    ["18", "evening"],
  ]) {
    await page.clock.setFixedTime(new Date(`2026-09-16T${hour}:00:00+08:00`));
    await page.goto("http://127.0.0.1:4321/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-atmosphere",
      phase,
    );
    const material = await page.evaluate(() => ({
      blur: parseFloat(
        document.documentElement.style.getPropertyValue("--glass-blur"),
      ),
      alpha: parseFloat(
        document.documentElement.style.getPropertyValue("--glass-alpha"),
      ),
    }));
    expect(material.blur).toBeGreaterThanOrEqual(10);
    expect(material.blur).toBeLessThanOrEqual(20);
    expect(material.alpha).toBeGreaterThanOrEqual(0.58);
    expect(material.alpha).toBeLessThanOrEqual(0.86);
    materials.push(material.blur);
    await page.waitForTimeout(750);
    await page.screenshot({
      path: path.resolve(`../../outputs/orbital-${phase}.png`),
    });
  }
  expect(materials[0]).toBeGreaterThan(materials[2]);
  const before = await page.locator("html").getAttribute("style");
  await page.clock.setFixedTime(new Date("2026-09-16T23:00:00+08:00"));
  expect(await page.locator("html").getAttribute("style")).toBe(before);
  await context.close();
});
