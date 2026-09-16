import { test, expect } from '@playwright/test';
import path from 'node:path';

test('real page snapshots dissolve with reproducible alpha-only masks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = original.call(this, frames, options);
      if (typeof options === 'object' && options.pseudoElement === '::view-transition-old(root)') {
        animation.pause();
        (window as any).dissolveTest = { animation, frames };
      }
      return animation;
    };
  });
  const hashes: string[] = [];
  for (const [width, height, seed] of [[1440, 1000, 0], [1440, 1000, 1], [1440, 1000, 0], [390, 844, 2]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/?seed=${seed}`);
    await expect(page.locator('.world-transition')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.seeded-hero')).toHaveJSProperty('naturalWidth', 2912);
    await page.locator('.nav-links a[href="/writing/"]').click();
    await page.waitForFunction(() => Boolean((window as any).dissolveTest));
    const result = await page.evaluate(async () => {
      const frames = (window as any).dissolveTest.frames;
      const values = [];
      for (const index of [0, 12, 24]) {
        const image = new Image();
        image.src = frames[index].maskImage.slice(5, -2);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        let visible = 0, color = 0;
        for (let i = 0; i < data.length; i += 4) {
          visible += data[i + 3] === 255 ? 1 : 0;
          color += data[i] + data[i + 1] + data[i + 2];
        }
        values.push({ coverage: visible / (data.length / 4), color });
      }
      return { values, middle: frames[12].maskImage };
    });
    expect(result.values[0].coverage).toBe(1);
    expect(result.values[1].coverage).toBeCloseTo(.5, 2);
    expect(result.values[2].coverage).toBe(0);
    expect(result.values.every(v => v.color === 0)).toBe(true);
    hashes.push(result.middle);
    for (const time of [0, 310, 620]) {
      await page.evaluate(time => { (window as any).dissolveTest.animation.currentTime = time; }, time);
      await page.screenshot({ path: path.resolve(`../../outputs/page-dissolve-${width}-${seed}-${time}.png`) });
    }
    await page.evaluate(() => (window as any).dissolveTest.animation.finish());
    await expect(page.locator('html')).not.toHaveAttribute('data-transition', 'dissolve');
  }
  expect(hashes[0]).toBe(hashes[2]);
  expect(hashes[0]).not.toBe(hashes[1]);
  expect(errors).toEqual([]);
});

test('native links, back, downloads and reduced motion remain intact', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.locator('.hero-link').click();
  await expect(page).toHaveURL(/#selected$/);
  await page.locator('.nav-links a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-world-seed', '1');
  await page.goBack();
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载简历', exact: true }).click();
  expect((await pending).suggestedFilename()).toBe('Sun-Haoran-Resume.pdf');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.nav-links a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-transition', 'dissolve');
});
