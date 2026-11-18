// Content collection for every page of the site (content/pages/*.md).
// The frontmatter schema is strict, an unknown key or a bad value fails the build.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const PAGE_TYPES = [
  'home', 'stone', 'compare', 'situation', 'guide', 'ritual', 'list', 'month', 'sign',
  'hub', 'directory', 'color', 'chakra', 'tool', 'trust', 'lab', 'essay',
] as const;

const pages = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './content/pages',
    // The file name is the id, "stones__amethyst.md" is "stones__amethyst".
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
    deferRender: true,
  }),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().min(1),
    h1: z.string().min(1),
    url: z.string().regex(/^\/([a-z0-9-]+\/)*$/, 'url must look like /section/slug/ with a trailing slash'),
    primary_keyword: z.string(),
    secondary_keywords: z.array(z.string()).default([]),
    author: z.string().min(1),
    publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'publishDate must be YYYY-MM-DD'),
    publishTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'publishTime must be HH:MM (New York time)'),
    status: z.enum(['draft', 'verified']),
    page_type: z.enum(PAGE_TYPES),
    sources: z.array(z.string().url()).default([]),
  }),
});

export const collections = { pages };
