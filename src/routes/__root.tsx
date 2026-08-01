import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Jacob & Vicki',
        description: 'Wedding details for Jacob and Vicki.'
      },
      { property: 'og:image', content: '/PXL_20251227_010505912.jpg' },
      { property: 'og:title', content: 'Jacob & Vicki' },
      { property: 'og:description', content: 'Wedding details for Jacob and Vicki.' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className='dark'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
