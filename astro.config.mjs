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
      // Injected automatically once a Blob store is linked to the project.
      // Until then it is simply absent and RSVPs are backed up to the runtime
      // logs alone — no infrastructure required for the code to be correct.
      BLOB_READ_WRITE_TOKEN: envField.string({
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
