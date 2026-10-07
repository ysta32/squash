import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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

/**
 * Public pages with their own social card. `scripts/gen-og.mjs` renders one 1200×630 PNG per
 * entry (DESIGN.md section 6) into `public/og/<slug>.png`, and the build writes a copy of
 * index.html at each path whose og:image / twitter:image point at that PNG, so link previews
 * (which never run JavaScript) show the right card. A page can be listed before its route
 * exists; adding the route is all that is left.
 */
export interface OgPage {
  path: string
  slug: string
  /** Short page name for the <title> and og:title ("Pricing — Squash"). */
  name: string
  /** Specimen label on the card, `·`-separated (rendered uppercase). */
  label: string
  /** Card headline. */
  title: string
  /** Optional line under the headline; also becomes the page's social description. */
  description?: string
}

export const OG_PAGES: readonly OgPage[] = [
  {
    path: '/',
    slug: 'home',
    name: 'Squash',
    label: 'Squash · Bug tracker for 2–10 people',
    title: 'Bug reports your cofounder actually reads.',
  },
  {
    path: '/features',
    slug: 'features',
    name: 'Features',
    label: 'Features',
    title: 'Capture, mark up, fix with Claude Code.',
  },
  {
    path: '/pricing',
    slug: 'pricing',
    name: 'Pricing',
    label: 'Pricing · Free · MIT',
    title: 'Free. MIT licensed.',
    description: 'Use the hosted instance at no cost, or run it on your own Supabase.',
  },
  {
    path: '/changelog',
    slug: 'changelog',
    name: 'Changelog',
    label: 'Changelog',
    title: 'What changed in Squash, release by release.',
  },
  {
    path: '/docs',
    slug: 'docs',
    name: 'Docs',
    label: 'Docs · Getting started',
    title: 'Run, use and self-host Squash.',
  },
  {
    path: '/faq',
    slug: 'faq',
    name: 'FAQ',
    label: 'FAQ',
    title: 'Where data lives, what Claude Code sees, and more.',
  },
  {
    path: '/about',
    slug: 'about',
    name: 'About',
    label: 'About',
    title: 'An open-source bug tracker for small teams.',
    description: 'MIT licensed. Built in the open on GitHub.',
  },
  {
    path: '/press',
    slug: 'press',
    name: 'Press kit',
    label: 'Press kit',
    title: 'Logos, colors, type and screenshots.',
  },
  {
    path: '/status',
    slug: 'status',
    name: 'Status',
    label: 'Status · Checked from your browser',
    title: 'Is Squash reachable right now?',
  },
  {
    path: '/privacy',
    slug: 'privacy',
    name: 'Privacy',
    label: 'Legal · Privacy',
    title: 'Privacy policy',
  },
  {
    path: '/terms',
    slug: 'terms',
    name: 'Terms',
    label: 'Legal · Terms',
    title: 'Terms of use',
  },
  {
    path: '/claude',
    slug: 'claude',
    name: 'Claude Code helper',
    label: 'Docs · Claude Code',
    title: 'Send a bug straight to Claude Code.',
  },
]

/** Site-relative image path for a page. Home keeps the long-standing /og.png. */
export function ogImagePath(page: Pick<OgPage, 'path' | 'slug'>): string {
  return page.path === '/' ? '/og.png' : `/og/${page.slug}.png`
}

export function transformSeoHtml(html: string, siteUrl?: string): string {
  return html.replaceAll('__SEO_SITE_URL__', escapeMarkup(resolveSiteUrl(siteUrl)))
}

/** Replaces the content of one existing <meta> tag; throws if index.html no longer has it. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const tag = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*("\\s*/?>)`)
  if (!tag.test(html)) throw new Error(`index.html is missing <meta ${attr}="${key}">`)
  return html.replace(tag, (_, open: string, close: string) => open + escapeMarkup(value) + close)
}

/**
 * The built index.html adjusted for one page: title, social title, image and alt text, plus the
 * description when the page has its own. `html` must already carry absolute URLs.
 */
export function pageHtml(html: string, page: OgPage, siteUrl?: string): string {
  const title = page.path === '/' ? null : `${page.name} — Squash`
  const image = `${resolveSiteUrl(siteUrl)}${ogImagePath(page)}`
  const alt = `${page.label.replaceAll(' · ', ', ')}: ${page.title}`
  let out = html
  if (title) {
    if (!/<title>[^<]*<\/title>/.test(out)) throw new Error('index.html is missing <title>')
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeMarkup(title)}</title>`)
    out = setMeta(out, 'property', 'og:title', title)
    out = setMeta(out, 'name', 'twitter:title', title)
  }
  out = setMeta(out, 'property', 'og:image', image)
  out = setMeta(out, 'name', 'twitter:image', image)
  out = setMeta(out, 'property', 'og:image:alt', alt)
  out = setMeta(out, 'name', 'twitter:image:alt', alt)
  if (page.description) {
    out = setMeta(out, 'name', 'description', page.description)
    out = setMeta(out, 'property', 'og:description', page.description)
    out = setMeta(out, 'name', 'twitter:description', page.description)
  }
  return out
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
  let outDir = 'dist'
  let publicDir = 'public'

  return {
    name: 'squash-seo',
    configResolved(config) {
      siteUrl = typeof config.env.VITE_SITE_URL === 'string' ? config.env.VITE_SITE_URL : undefined
      outDir = resolve(config.root, config.build.outDir)
      publicDir = config.publicDir
    },
    transformIndexHtml(html) {
      return transformSeoHtml(html, siteUrl)
    },
    generateBundle() {
      const { robots, sitemap } = createSeoAssets(siteUrl)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
    // After Vite has written the final index.html (hashed assets, font preload), copy it to
    // <path>/index.html for each public page so its social card is right without JavaScript.
    writeBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset' || typeof index.source !== 'string') return
      for (const page of OG_PAGES) {
        if (page.path === '/') continue
        if (!publicDir || !existsSync(join(publicDir, ogImagePath(page)))) {
          this.error(`Missing ${ogImagePath(page)}: run npm run gen:og`)
        }
        const file = join(outDir, page.path, 'index.html')
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, pageHtml(index.source, page, siteUrl))
      }
    },
  }
}
