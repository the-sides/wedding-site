import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        concurrency: 1,
        enabled: true,
        crawlLinks: false, // Auto-discover pages from links
        failOnError: false, // Don't fail build on prerender errors (nitro-nightly should fix race condition)
        retryCount: 3,
        retryDelay: 1000,
      },
    }),
    nitro({
      preset: 'vercel',
    }),
    viteReact(),
  ],
})

export default config
