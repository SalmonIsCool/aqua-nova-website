import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const newsCollection = defineCollection({
  loader: glob({ base: "./src/content/news", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    coverImage: z.string().optional()
  })
});

const eventsCollection = defineCollection({
  loader: glob({ base: "./src/content/events", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    endDate: z.date().optional(),
    excerpt: z.string(),
    location: z.string().optional()
  })
});

const mediaCollection = defineCollection({
  loader: glob({ base: "./src/content/media", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    type: z.enum(["image", "video", "download"]),
    image: z.string().optional(),
    url: z.string().optional(),
    excerpt: z.string()
  })
});

export const collections = {
  news: newsCollection,
  events: eventsCollection,
  media: mediaCollection
};
