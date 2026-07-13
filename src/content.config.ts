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

export const collections = { writing };
