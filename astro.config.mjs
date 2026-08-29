// @ts-check
import { defineConfig, envField } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  // Pages are prerendered to static HTML at build time. The Notion webhook
  // opts out with `export const prerender = false` and becomes a Vercel
  // Function, which is what lets it trigger a redeploy on Notion edits.
  output: "static",

  adapter: vercel(),

  // Secrets are read from the live process rather than inlined at build time,
  // so the webhook picks up VERCEL_DEPLOY_HOOK at runtime. All are optional so
  // an unconfigured environment degrades to an empty post list instead of
  // failing the build.
  env: {
    schema: {
      NOTION_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      NOTION_DATABASE_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      NOTION_DATA_SOURCE_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // The RSVP Submissions inbox — a different data source from the posts
      // one above, and the only database the public form can write to.
      NOTION_RSVP_DATA_SOURCE_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Injected automatically when a Blob store is linked to the project.
      // This is the credential the linked store actually provides: the SDK
      // pairs it with the ambient OIDC token, and no read-write token is
      // created at all.
      BLOB_STORE_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // The manual alternative — a long-lived token from the Blob dashboard.
      // Not set by linking a store, so normally absent. Present only where
      // OIDC is unavailable; when it is set the SDK prefers OIDC anyway.
      BLOB_READ_WRITE_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // A Discord incoming webhook URL. It is bound to one channel by
      // Discord, so the channel an RSVP lands in is chosen when the URL is
      // created rather than anywhere in this repo. Absent means no pings.
      DISCORD_RSVP_WEBHOOK_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Optional text prepended to each ping, for an actual notification
      // rather than a quiet message — e.g. `<@&123...>` for a role or
      // `<@123...>` for a person. @everyone is deliberately not honoured.
      DISCORD_RSVP_MENTION: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      VERCEL_DEPLOY_HOOK: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});
