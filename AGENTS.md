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
   forever. Inactive until a Blob store is linked to the project, which
   injects `BLOB_READ_WRITE_TOKEN`; without it the code logs a warning and
   carries on.

To read the archive back:

```
vercel env pull            # for BLOB_READ_WRITE_TOKEN
bun scripts/dump-rsvps.ts > rsvps.csv
```

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
