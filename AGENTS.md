## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Hero artwork

The hero backdrop is not a flat photo. `art/walking.xcf` is a layered GIMP
file — a backdrop plus Jacob's head and jaw as separate cutouts — and

```
bun scripts/import-xcf.ts art/walking.xcf
```

slices it into `public/hero/*` and regenerates `src/lib/hero-layers.ts`. Both
outputs are generated; edit the `.xcf` and re-run rather than touching them.
Commit the regenerated files alongside the art.

`Hero.astro` stacks the layers back up over one canvas box scaled to cover the
section, so each layer can be moved on its own — see the CSS at the bottom of
that file for the hooks (`--dx`, `--dy`, `--rotate`, `--pivot`) and for the
puppet rules gated on `[data-allegiance="jacob"]`.

Two things to know before moving a layer far:

- **Lifting a piece out leaves a white hole behind it.** The backdrop has a
  head-shaped hole, and the head layer has a jaw-shaped one. Each cutout is
  therefore rendered twice — once blacked out and pinned at rest as a
  "socket", once live — so a moving layer reveals shadow rather than paper.
  Painting real content into those holes in GIMP is what would allow large
  movement; until then the socket is what makes any movement survivable.

- **The layer name is the contract.** A layer called `jaw` becomes
  `public/hero/jaw.png` with the slug `jaw`, which is what the CSS selects on.
  Renaming a layer in GIMP renames its asset and breaks any rule targeting the
  old name.

The import needs GIMP 3 on PATH (`gimp-console`). It is a build-time tool
only — nothing at runtime depends on it.

## RSVP backups

Every submission is archived by `src/lib/rsvp-backup.ts` _before_ the Notion
write, so a Notion outage costs a retry rather than a guest's answer. Two
sinks, in order of durability:

1. **Runtime logs.** Always on, no setup. Search Vercel logs for
   `RSVP received` — each line is the complete payload as JSON. Retention is
   only a few days.
2. **Vercel Blob.** One private JSON file per submission under `rsvps/`, kept
   forever. Live in any deployed environment: linking a store injects
   `BLOB_STORE_ID`, which the SDK pairs with Vercel's ambient OIDC token.
   Note that **no `BLOB_READ_WRITE_TOKEN` is created** by linking a store —
   code that requires one will silently never write. With no credentials at
   all the backup logs a warning and carries on. A write that stalls is
   abandoned after five seconds, so a Blob outage costs the guest a pause
   rather than the whole submission.

To read the archive back:

```
vercel env pull
bun --env-file=.env.local scripts/dump-rsvps.ts > rsvps.csv
```

`vercel env pull` mints a _development_-scoped OIDC token, and a store only
honours the environments enabled for the project — so from a laptop this also
needs either **Development** ticked under Project Settings → Secure Backend
Access, or a `BLOB_READ_WRITE_TOKEN` created by hand in the Blob dashboard.
Neither is needed where Vercel supplies its own OIDC token.

The `submission` id is shared by the backup and the Notion rows from the same
POST, so a party half-written to Notion can be reconciled against the backup.

## Discord notifications

Each submission pings a Discord channel via `src/lib/rsvp-notify.ts`. This is
an **incoming webhook, not a bot** — nothing runs between requests to hold a
gateway connection open, and a webhook needs no bot process or token rotation.

Set up:

1. Discord → Server Settings → Integrations → Webhooks → New Webhook. Pick the
   channel there; the URL is bound to it, so the channel is not configured
   anywhere in this repo.
2. `vercel env add DISCORD_RSVP_WEBHOOK_URL` (all environments).
3. Optionally `vercel env add DISCORD_RSVP_MENTION` with `<@&ROLE_ID>` or
   `<@USER_ID>` to make it an actual notification. `@everyone` is deliberately
   not honoured — `allowed_mentions` permits roles and users only.

With no webhook set, nothing is sent and nothing warns. The ping fires _after_
the Notion write so it can report whether the reply landed, and it fires on
failure too — a red "save failed" embed is the case most worth being told
about. Like the backup it never throws and gives up after three seconds, so a
Discord outage costs a pause rather than a submission.

Guest-typed text only ever goes in the embed, never in `content`: Discord does
not resolve mentions inside embeds, so a guest who names themselves
`@everyone` cannot ping the server. Markdown in names is escaped.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
