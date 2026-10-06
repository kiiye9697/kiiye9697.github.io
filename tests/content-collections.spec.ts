import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('collection drafts stay private and explicit published entries appear', async () => {
  test.setTimeout(180000);
  const files: string[] = [];
  const build = () => execFileSync(process.execPath, ['node_modules/astro/astro.js', 'build', '--force'], {stdio:'pipe'});
  try {
    for (const collection of ['places', 'echoes']) {
      for (const state of ['public', 'default', 'draft']) {
        const slug = `echo-validation-${collection}-${state}`;
        const filename = `src/content/${collection}/${slug}.md`;
        const status = state === 'public' ? 'draft: false\n' : state === 'draft' ? 'draft: true\n' : '';
        const media = collection === 'places' ? 'category: game\ncover: /background1.jpg\nalt: Local validation fixture\nsource: Local test\ncredit: Local test\n' : '';
        await fs.writeFile(filename, `---\ntitle: ${slug}\nslug: ${slug}\ndate: 2026-10-06\n${status}${media}---\n\nLocal test only.\n`, {flag:'wx'});
        files.push(filename);
      }
    }
    build();
    const home = await fs.readFile('dist/index.html', 'utf8');
    for (const collection of ['places', 'echoes']) {
      const listing = await fs.readFile(`dist/${collection === 'places' ? 'gallery' : 'echoes'}/index.html`, 'utf8');
      expect(home).toContain(`echo-validation-${collection}-public`);
      expect(listing).toContain(`echo-validation-${collection}-public`);
      for (const state of ['default', 'draft']) {
        expect(home).not.toContain(`echo-validation-${collection}-${state}`);
        expect(listing).not.toContain(`echo-validation-${collection}-${state}`);
      }
    }
    expect(await fs.readFile('dist/gallery/echo-validation-places-public/index.html','utf8')).toContain('Local test only.');
    for (const state of ['default','draft']) {
      await expect(fs.access(`dist/gallery/echo-validation-places-${state}/index.html`)).rejects.toThrow();
    }
  } finally {
    await Promise.all(files.map(filename => fs.unlink(filename)));
    build();
  }
  const writing = (await fs.readdir('src/content/writing')).filter(name => name.endsWith('.md'));
  for (const filename of writing) await fs.access(`dist/writing/${filename.replace(/\.md$/, '')}/index.html`);
  expect(writing).toHaveLength(29);
  for (const route of ['index.html', 'gallery/index.html', 'echoes/index.html']) {
    expect(await fs.readFile(`dist/${route}`, 'utf8')).not.toContain('echo-validation');
  }
});
