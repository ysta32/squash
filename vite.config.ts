import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin } from './vite-plugin-seo'
import { bridgeConfigPlugin } from './vite-plugin-bridge'

/** Preloads the Latin IBM Plex Sans file so body text renders in Plex on first paint. */
function fontPreloadPlugin(): Plugin {
  let base = '/'
  return {
    name: 'squash-font-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((file) =>
          /ibm-plex-sans-latin-wght-normal[^/]*\.woff2$/.test(file),
        )
        if (!font) throw new Error('IBM Plex Sans latin woff2 is missing from the build')
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `${base}${font}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin(), bridgeConfigPlugin(), fontPreloadPlugin()],
})
