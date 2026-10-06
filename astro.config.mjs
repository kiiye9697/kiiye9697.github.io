import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export default defineConfig({
  output: "static",
  // Use the native implementation for existing type: content Markdown collections.
  legacy: { collections: true },
  devToolbar: { enabled: false },
  site: "https://kiiye9697.github.io",
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
