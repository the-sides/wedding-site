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
`astro.config.mjs`; all are optional, so an unconfigured environment renders an
empty state on `/extras` instead of failing the build.

## Scripts

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `bun run dev`       | Dev server on port 3000                           |
| `bun run build`     | Prerender to `dist/` and emit `.vercel/output/`   |
| `bun run preview`   | Serve the production build                        |
| `bun run check`     | Type-check `.astro` and `.ts` files               |

## How it renders

Every page is prerendered to static HTML at build time. Only `/rsvp` ships
client JavaScript — the RSVP form is a React island (`client:load`); every
other page is plain HTML. Notion is queried during the build in
`src/pages/extras.astro`.

`src/pages/api/notion-webhook.ts` is the one exception: it sets
`export const prerender = false`, so it deploys as a Vercel Function. Notion
calls it on edits and it POSTs to `VERCEL_DEPLOY_HOOK`, which rebuilds the site
and picks up the new content.

## Layout

The home page is a signpost — hero plus four links — and each section it used
to stack inline now has its own route.

```
src/
  pages/index.astro              hero + the four links
  pages/rsvp.astro               the RSVP form
  pages/schedule.astro           the day's timing
  pages/venue.astro              where it happens
  pages/extras.astro             updates + build-time Notion fetch
  pages/api/rsvp.ts              form endpoint, writes to Notion
  pages/api/notion-webhook.ts    on-demand endpoint, triggers redeploys
  layouts/Layout.astro           <html> shell, meta tags, global styles
  layouts/PageLayout.astro       interior page chrome — header, title, footer
  lib/nav.ts                     the four links, shared by both navs
  components/Hero.astro          masthead
  components/HomeNav.astro       the four link cards
  components/SiteHeader.astro    interior page nav
  components/SiteFooter.astro    closing band
  components/ComingSoon.astro    placeholder card for undecided details
  components/Posts.astro         updates grid
  components/PostBody.astro      groups Notion list runs into <ul>/<ol>
  components/Block.astro         one Notion block
  components/RichText.astro      Notion rich text spans
  components/Annotations.astro   recursive bold/italic/link wrappers
  components/rsvp/               the React form and its fields
  lib/notion.ts                  Notion client and response mapping
```

## Notes

- `bun run check` requires TypeScript 6.x. TypeScript 7's native compiler does
  not yet expose the API `astro check` depends on.
- Notion-hosted images are served from signed S3 URLs that expire an hour after
  the build. Images pasted into Notion posts will 403 until the next rebuild;
  external image URLs are unaffected.
