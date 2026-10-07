import type { Plugin } from 'vite'

export function resolveSiteUrl(siteUrl?: string): string {
  return (siteUrl?.trim() || 'https://squash-livid.vercel.app').replace(/\/+$/, '')
}

function escapeMarkup(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function transformSeoHtml(html: string, siteUrl?: string): string {
  return html.replaceAll('__SEO_SITE_URL__', escapeMarkup(resolveSiteUrl(siteUrl)))
}

export function createSeoAssets(siteUrl?: string): { robots: string; sitemap: string } {
  const baseUrl = resolveSiteUrl(siteUrl)
  const urls = ['/', '/claude', '/privacy', '/terms']
    .map((path) => `  <url><loc>${escapeMarkup(`${baseUrl}${path}`)}</loc></url>`)
    .join('\n')

  return {
    robots: `User-agent: *\nAllow: /\nDisallow: /app$\nDisallow: /app/\nDisallow: /auth/\nDisallow: /signin\nDisallow: /join/\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  }
}

export function seoPlugin(): Plugin {
  let siteUrl: string | undefined

  return {
    name: 'squash-seo',
    configResolved(config) {
      siteUrl = typeof config.env.VITE_SITE_URL === 'string' ? config.env.VITE_SITE_URL : undefined
    },
    transformIndexHtml(html) {
      return transformSeoHtml(html, siteUrl)
    },
    generateBundle() {
      const { robots, sitemap } = createSeoAssets(siteUrl)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
  }
}
