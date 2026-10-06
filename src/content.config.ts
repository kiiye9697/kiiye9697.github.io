import { defineCollection, z } from "astro:content";

const writing = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    course: z.string(),
    source: z.string().optional(),
    order: z.number().default(0),
  }),
});

const places = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(), category: z.enum(["travel", "game"]),
    draft: z.boolean().default(true), date: z.coerce.date().optional(),
    cover: z.string(), alt: z.string(), source: z.string(), credit: z.string(),
  }),
});
const echoes = defineCollection({
  type: "content",
  schema: z.object({title: z.string().optional(), date: z.coerce.date(), draft: z.boolean().default(true)}),
});
export const collections = { writing, places, echoes };
