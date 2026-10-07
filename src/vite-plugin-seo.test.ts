import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import { createSeoAssets, resolveSiteUrl, transformSeoHtml } from '../vite-plugin-seo'

describe('SEO build helpers', () => {
  it.each([undefined, '', '   '])('uses the deployment fallback for %j', (siteUrl) => {
    expect(resolveSiteUrl(siteUrl)).toBe('https://squash-livid.vercel.app')
    expect(createSeoAssets(siteUrl).robots).toContain(
      'Sitemap: https://squash-livid.vercel.app/sitemap.xml',
    )
  })

  it('strips trailing slashes from the configured site URL', () => {
    expect(resolveSiteUrl(' https://squash.example/// ')).toBe('https://squash.example')
  })

  it('makes social images absolute without assigning a shared canonical URL', () => {
    const document = new DOMParser().parseFromString(
      transformSeoHtml(html, 'https://squash.example/'),
      'text/html',
    )
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(document.querySelector(selector)?.getAttribute('content')).toBe(
        'https://squash.example/og.png',
      )
    }
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('generates crawl rules and only the four public sitemap routes', () => {
    const { robots, sitemap } = createSeoAssets('https://squash.example/')
    expect(robots).toBe(
      'User-agent: *\nAllow: /\nDisallow: /app$\nDisallow: /app/\nDisallow: /auth/\nDisallow: /signin\nDisallow: /join/\n\nSitemap: https://squash.example/sitemap.xml\n',
    )
    const document = new DOMParser().parseFromString(sitemap, 'application/xml')
    expect(document.querySelector('parsererror')).toBeNull()
    expect(document.documentElement.namespaceURI).toBe(
      'http://www.sitemaps.org/schemas/sitemap/0.9',
    )
    expect(Array.from(document.querySelectorAll('loc'), (loc) => loc.textContent)).toEqual([
      'https://squash.example/',
      'https://squash.example/claude',
      'https://squash.example/privacy',
      'https://squash.example/terms',
    ])
  })

  it('escapes markup characters in generated HTML and XML', () => {
    const siteUrl = 'https://squash.example/a&b'
    expect(transformSeoHtml('<link href="__SEO_SITE_URL__/" />', siteUrl)).toBe(
      '<link href="https://squash.example/a&amp;b/" />',
    )
    const { sitemap } = createSeoAssets(siteUrl)
    const document = new DOMParser().parseFromString(sitemap, 'application/xml')
    expect(document.querySelector('parsererror')).toBeNull()
    expect(document.querySelector('loc')?.textContent).toBe(`${siteUrl}/`)
  })
})
