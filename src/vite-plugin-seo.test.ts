import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  OG_PAGES,
  createSeoAssets,
  ogImagePath,
  pageHtml,
  resolveSiteUrl,
  transformSeoHtml,
} from '../vite-plugin-seo'

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

  it('has a committed social card for every public page, with unique slugs', () => {
    const slugs = OG_PAGES.map((page) => page.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of ['home', 'features', 'pricing', 'changelog', 'docs', 'faq', 'about']) {
      expect(slugs).toContain(slug)
    }
    for (const slug of ['press', 'status', 'privacy', 'terms', 'claude']) {
      expect(slugs).toContain(slug)
    }
    for (const page of OG_PAGES) {
      const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', ogImagePath(page))
      expect(existsSync(file), file).toBe(true)
    }
  })

  it('points each page copy of index.html at its own social card', () => {
    const built = transformSeoHtml(html, 'https://squash.example')
    const pricing = OG_PAGES.find((page) => page.slug === 'pricing')!
    const document = new DOMParser().parseFromString(
      pageHtml(built, pricing, 'https://squash.example'),
      'text/html',
    )
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(document.querySelector(selector)?.getAttribute('content')).toBe(
        'https://squash.example/og/pricing.png',
      )
    }
    expect(document.title).toBe('Pricing — Squash')
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'Pricing — Squash',
    )
    expect(document.querySelector('meta[property="og:image:alt"]')?.getAttribute('content')).toBe(
      'Pricing, Free, MIT: Free. MIT licensed.',
    )
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      pricing.description,
    )
    // Home keeps the original card and copy.
    const home = OG_PAGES.find((page) => page.path === '/')!
    expect(pageHtml(built, home, 'https://squash.example')).toContain(
      'content="https://squash.example/og.png"',
    )
  })

  it('refuses to build page copies from an index.html without the social tags', () => {
    expect(() => pageHtml('<title>x</title>', OG_PAGES[1])).toThrow(/og:title/)
  })
})
