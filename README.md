# Jacob & Vicki's Wedding

Wedding site for Jacob and Vicki, built with [Astro](https://astro.build) and
backed by Notion for updates.

## Development

```sh
bun install
bun run dev
```

Copy `.env.example` to `.env` and configure the Notion integration variables to
load wedding posts. The variables are declared as a typed schema under `env` in
`astro.config.mjs`; all are optional, so an unconfigured environment renders the
hero without the updates section instead of failing.

## Scripts

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `bun run dev`       | Dev server on port 3000                           |
| `bun run build`     | Prerender to `dist/` and emit `.vercel/output/`   |
| `bun run preview`   | Serve the production build                        |
| `bun run check`     | Type-check `.astro` and `.ts` files               |

## How it renders

Every page is prerendered to static HTML at build time and ships **no client
JavaScript** — the site has no interactive components. Notion is queried during
the build in `src/pages/index.astro`.

`src/pages/api/notion-webhook.ts` is the one exception: it sets
`export const prerender = false`, so it deploys as a Vercel Function. Notion
calls it on edits and it POSTs to `VERCEL_DEPLOY_HOOK`, which rebuilds the site
and picks up the new content.

## Layout

```
src/
  pages/index.astro              page composition + build-time Notion fetch
  pages/api/notion-webhook.ts    on-demand endpoint, triggers redeploys
  layouts/Layout.astro           <html> shell, meta tags, global styles
  components/Hero.astro          masthead
  components/Posts.astro         updates grid
  components/PostBody.astro      groups Notion list runs into <ul>/<ol>
  components/Block.astro         one Notion block
  components/RichText.astro      Notion rich text spans
  components/Annotations.astro   recursive bold/italic/link wrappers
  lib/notion.ts                  Notion client and response mapping
```

## Notes

- `bun run check` requires TypeScript 6.x. TypeScript 7's native compiler does
  not yet expose the API `astro check` depends on.
- Notion-hosted images are served from signed S3 URLs that expire an hour after
  the build. Images pasted into Notion posts will 403 until the next rebuild;
  external image URLs are unaffected.
