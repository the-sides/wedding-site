## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

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
