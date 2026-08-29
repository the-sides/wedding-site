## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## RSVP backups

Every submission is archived by `src/lib/rsvp-backup.ts` *before* the Notion
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

`vercel env pull` mints a *development*-scoped OIDC token, and a store only
honours the environments enabled for the project — so from a laptop this also
needs either **Development** ticked under Project Settings → Secure Backend
Access, or a `BLOB_READ_WRITE_TOKEN` created by hand in the Blob dashboard.
Neither is needed where Vercel supplies its own OIDC token.

The `submission` id is shared by the backup and the Notion rows from the same
POST, so a party half-written to Notion can be reconciled against the backup.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
