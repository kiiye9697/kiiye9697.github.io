import { test, expect } from "@playwright/test";

test("echo signal runs in view and pauses offscreen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/portfolio/");
  const ring = page.locator(".echo-orbits span").first();
  await expect(ring).toHaveCSS("animation-play-state", "running");
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(ring).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => scrollTo(0, 0));
  await expect(ring).toHaveCSS("animation-name", "none");
  expect(errors).toEqual([]);
});

test("personal gallery filters planned themes without creating fake entries", async ({ page }) => {
  await page.goto("/gallery/");
  await expect(page.locator(".place-reservation:visible")).toHaveCount(3);
  await expect(page.locator(".place-reservation a")).toHaveCount(0);
  await page.getByRole("button", { name: "游戏世界", exact: true }).click();
  await expect(page.locator(".place-reservation:visible")).toHaveCount(2);
  await expect(page.locator("[data-filter-status]")).toContainText("2 个预留展位");
  await page.getByRole("button", { name: "现实地点", exact: true }).click();
  await expect(page.locator(".place-reservation:visible")).toHaveCount(1);
  await expect(page.locator(".place-reservation:visible")).toContainText("安菲尔德体育场");
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await expect(page.locator(".place-reservation:visible")).toHaveCount(3);
  await page.goto("/echoes/");
  await expect(page.locator(".echo-empty")).toContainText("暂时还没有发布碎碎念");
  await expect(page.locator(".echo-feed article")).toHaveCount(0);
});

test("capture Echo pages at desktop and mobile sizes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, width, height] of [["desktop",1440,1000],["mobile",390,844],["small",320,740]] as const) {
    await page.setViewportSize({ width, height });
    for (const [route,label] of [["/","home"],["/portfolio/","portfolio"],["/gallery/","gallery"],["/echoes/","echoes"],["/projects/sdf-baker/","sdf"]]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 16, 13)');
      await page.screenshot({path:`../../outputs/echo-${label}-${name}.png`});
      if (name !== 'small') await page.screenshot({path:`../../outputs/echo-${label}-${name}-full.png`,fullPage:true});
    }
  }
});

test("new collections remain readable with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:740}});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/gallery/');
  await expect(page.locator('.place-reservation')).toHaveCount(3);
  await expect(page.locator('.place-reservation').first()).toBeVisible();
  await page.locator('.nav-links a[href="/echoes/"]').click();
  await expect(page.locator('.echo-empty')).toBeVisible();
  await context.close();
});
