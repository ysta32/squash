// Build-time content for the marketing site: the changelog (CHANGELOG.md) and the docs
// (docs/site/*.md), rendered from Markdown to HTML here so no Markdown parser ships to the browser.
//
// - `virtual:squash-content` is a small manifest (doc titles, headings, release list, a content
//   hash). It is bundled into the lazy marketing chunks.
// - The rendered bodies are data, not code: they are written as JSON next to the build
//   (`/content/changelog.json`, `/content/docs/<slug>.json`) and fetched by the page, so the
//   JavaScript budget (scripts/size-check.mjs) only pays for the pages, not for every word.
// - `/changelog.xml` is an RSS 2.0 feed of the tagged releases.
// The dev server serves the same files from memory, recomputed on every request.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import type {
  ChangelogContent,
  ContentManifest,
  DocBody,
  DocHeading,
  DocMeta,
  PressShot,
  ReleaseEntry,
} from './src/components/marketing/content-types'
import { resolveSiteUrl } from './vite-plugin-seo'

export const CONTENT_MODULE_ID = 'virtual:squash-content'
const RESOLVED_ID = `\0${CONTENT_MODULE_ID}`
export const DOCS_DIR = 'docs/site'
/** A line in a doc that the page replaces with the live shortcut table (facts.shortcuts). */
export const SHORTCUTS_MARKER = '<!-- shortcuts -->'

// ---------------------------------------------------------------------------------------------
// Markdown → HTML. A deliberately small subset: headings, paragraphs, flat lists, fenced code,
// tables, and inline code / bold / italics / links / <kbd>. All other HTML is escaped, and links
// only keep http(s), site-relative and in-page targets, so the output is safe to inject.
// ---------------------------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** `Getting started` → `getting-started`; keeps dots so `v1.7.0` stays readable. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9.\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function safeHref(href: string): string | null {
  const url = href.trim()
  if (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) || url.startsWith('#')) return url
  return null
}

/** Inline Markdown for text outside code spans (already HTML-escaped). */
function inlineText(escaped: string): string {
  return escaped
    .replace(/&lt;(\/?)kbd&gt;/g, '<$1kbd>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text: string, href: string) => {
      // `href` is escaped text; unescape the one entity a URL may legitimately contain.
      const target = safeHref(href.replaceAll('&amp;', '&'))
      if (!target) return text
      const external = /^https?:/i.test(target)
      return `<a href="${escapeHtml(target)}"${external ? ' rel="noreferrer"' : ''}>${text}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>')
}

export function renderInline(text: string): string {
  // Lift code spans out first (nothing inside backticks is Markdown), render the rest, then put
  // them back, so emphasis can wrap a code span: **Needs `0007.sql`.**
  const codes: string[] = []
  const lifted = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`)
    return `\uE000${codes.length - 1}\uE001`
  })
  return inlineText(escapeHtml(lifted)).replace(
    /\uE000(\d+)\uE001/g,
    (_, n: string) => codes[Number(n)],
  )
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

export interface RenderedMarkdown {
  html: string
  headings: DocHeading[]
}

/**
 * Renders Markdown to HTML. Every h2/h3 gets a unique id plus a permalink so a section can be
 * linked to (the page itself renders the h1).
 */
export function renderMarkdown(source: string): RenderedMarkdown {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const headings: DocHeading[] = []
  const used = new Set<string>()
  let i = 0

  const uniqueId = (text: string) => {
    const base = slugify(text) || 'section'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return id
  }
  const isBlockStart = (line: string) =>
    /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\|/.test(line) ||
    line.trim() === SHORTCUTS_MARKER

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.trim() === SHORTCUTS_MARKER) {
      out.push(SHORTCUTS_MARKER)
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      const inner = renderInline(text)
      if (level === 2 || level === 3) {
        const id = uniqueId(text)
        const plain = htmlToText(inner)
        headings.push({ id, text: plain, level })
        out.push(
          `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to ${escapeHtml(plain)}">#</a></h${level}>`,
        )
      } else {
        out.push(`<h${level}>${inner}</h${level}>`)
      }
      i++
      continue
    }
    const fence = /^```\s*([\w-]*)\s*$/.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++])
      i++ // closing fence (or end of input)
      const lang = fence[1] ? ` data-lang="${escapeHtml(fence[1])}"` : ''
      out.push(`<pre${lang}><code>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = tableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(tableCells(lines[i++]))
      out.push(
        `<div class="table"><table><thead><tr>${head.map((c) => `<th scope="col">${renderInline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      )
      continue
    }
    const listMatch = /^\s*([-*]|\d+\.)\s+/.exec(line)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1])
      const items: string[] = []
      while (i < lines.length) {
        const item = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i])
        if (item && /\d/.test(item[1]) === ordered) {
          items.push(item[2])
          i++
        } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) {
          // A wrapped continuation line of the previous item.
          items[items.length - 1] += ` ${lines[i].trim()}`
          i++
        } else break
      }
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]))
      para.push(lines[i++].trim())
    out.push(`<p>${renderInline(para.join(' '))}</p>`)
  }
  return { html: out.join('\n'), headings }
}

// ---------------------------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------------------------

const RELEASE_HEADING = /^(v\d+\.\d+\.\d+)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})\s*$/

/** The leading paragraph of a section, if it opens with one (the release's one-line summary). */
function splitSummary(body: string): { summary: string | null; rest: string } {
  const trimmed = body.replace(/^\s*\n/, '')
  const first = trimmed.split(/\n\s*\n/)[0] ?? ''
  if (!first.trim() || /^(#|\s*[-*]\s|\s*\d+\.\s|```|\|)/.test(first)) {
    return { summary: null, rest: trimmed }
  }
  return {
    summary: first.replace(/\s*\n\s*/g, ' ').trim(),
    rest: trimmed.slice(trimmed.indexOf(first) + first.length),
  }
}

/** Parses CHANGELOG.md: the Unreleased section (if any) and every `## vX.Y.Z — date` release. */
export function parseChangelog(markdown: string): ChangelogContent {
  const sections = markdown.replace(/\r\n?/g, '\n').split(/^## /m).slice(1)
  let unreleased: ChangelogContent['unreleased'] = null
  const releases: ReleaseEntry[] = []
  for (const section of sections) {
    const newline = section.indexOf('\n')
    const title = (newline < 0 ? section : section.slice(0, newline)).trim()
    const body = newline < 0 ? '' : section.slice(newline + 1)
    if (/^unreleased$/i.test(title)) {
      const html = renderMarkdown(body).html
      unreleased = { html, empty: html.trim() === '' }
      continue
    }
    const release = RELEASE_HEADING.exec(title)
    if (!release) throw new Error(`CHANGELOG.md: unexpected section heading "## ${title}"`)
    const { summary, rest } = splitSummary(body)
    releases.push({
      version: release[1],
      date: release[2],
      id: release[1],
      summary: summary ? renderInline(summary) : null,
      html: renderMarkdown(rest).html.replace(/ id="[^"]*"|<a class="anchor"[^>]*>#<\/a>/g, ''),
    })
  }
  if (releases.length === 0) throw new Error('CHANGELOG.md: no "## vX.Y.Z — YYYY-MM-DD" releases')
  return { unreleased, releases }
}

/** RFC 822 date for RSS, at noon UTC so the day is right in every time zone that reads it. */
function rssDate(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toUTCString()
}

/** Plain text of rendered inline HTML: tags dropped, the entities escapeHtml writes decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** RSS 2.0 feed of tagged releases (Unreleased is left out: it has no date and may change). */
export function buildRss(changelog: ChangelogContent, siteUrl?: string): string {
  const base = resolveSiteUrl(siteUrl)
  const page = `${base}/changelog`
  const items = changelog.releases
    .map((release) => {
      const link = `${page}#${release.id}`
      const html = `${release.summary ? `<p>${release.summary}</p>` : ''}${release.html}`
      const plainSummary = release.summary ? htmlToText(release.summary) : null
      return [
        '    <item>',
        `      <title>${escapeXml(`Squash ${release.version}${plainSummary ? `: ${plainSummary}` : ''}`)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${rssDate(release.date)}</pubDate>`,
        `      <description>${escapeXml(html)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Squash changelog</title>
    <link>${escapeXml(page)}</link>
    <atom:link href="${escapeXml(`${base}/changelog.xml`)}" rel="self" type="application/rss+xml" />
    <description>Every tagged release of Squash, the open-source bug tracker for small teams.</description>
    <language>en</language>
    <lastBuildDate>${rssDate(changelog.releases[0].date)}</lastBuildDate>
${items}
  </channel>
</rss>
`
}

// ---------------------------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------------------------

/** `---\nkey: value\n---` front matter, then the Markdown body. */
export function parseFrontMatter(source: string): { data: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source.replace(/\r\n?/g, '\n'))
  if (!match) return { data: {}, body: source }
  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const pair = /^(\w+):\s*(.*)$/.exec(line.trim())
    if (pair) data[pair[1]] = pair[2].trim()
  }
  return { data, body: source.slice(match[0].length) }
}

export interface LoadedDoc {
  meta: DocMeta
  body: DocBody
}

export function parseDoc(slug: string, source: string): LoadedDoc {
  const { data, body } = parseFrontMatter(source)
  for (const key of ['title', 'description', 'group', 'order'] as const) {
    if (!data[key]) throw new Error(`${DOCS_DIR}/${slug}.md: front matter is missing "${key}"`)
  }
  if (data.group !== 'Use' && data.group !== 'Run') {
    throw new Error(`${DOCS_DIR}/${slug}.md: group must be "Use" or "Run"`)
  }
  const rendered = renderMarkdown(body)
  return {
    meta: {
      slug,
      title: data.title,
      description: data.description,
      group: data.group,
      order: Number(data.order),
      headings: rendered.headings,
    },
    body: { html: rendered.html },
  }
}

export function loadDocs(root: string): LoadedDoc[] {
  const dir = join(root, DOCS_DIR)
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseDoc(name.slice(0, -3), readFileSync(join(dir, name), 'utf8')))
    .sort((a, b) => a.meta.order - b.meta.order || a.meta.slug.localeCompare(b.meta.slug))
}

// ---------------------------------------------------------------------------------------------
// Press kit: the README screenshots (docs/screenshots), published at /press/<file> so the press
// page can offer them as downloads without a second copy in the repository.
// ---------------------------------------------------------------------------------------------

export const SCREENSHOTS_DIR = 'docs/screenshots'

/** Screenshots offered in the press kit, in display order, with what each one shows. */
export const PRESS_SHOTS: { name: string; caption: string }[] = [
  { name: 'hero-light', caption: 'Workspace, light' },
  { name: 'hero-dark', caption: 'Workspace, dark' },
  { name: 'capture-light', caption: 'Capture bar, light' },
  { name: 'capture-dark', caption: 'Capture bar, dark' },
  { name: 'annotate-light', caption: 'Markup editor, light' },
  { name: 'annotate-dark', caption: 'Markup editor, dark' },
  { name: 'claude-light', caption: 'Claude Code at work, light' },
  { name: 'claude-dark', caption: 'Claude Code at work, dark' },
  { name: 'palette-light', caption: 'Command palette, light' },
  { name: 'palette-dark', caption: 'Command palette, dark' },
  { name: 'mobile', caption: 'On phones' },
]

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.length < 24 || signature.some((byte, i) => png[i] !== byte)) {
    throw new Error('not a PNG file')
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function loadPressShots(root: string): { meta: PressShot[]; files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>()
  const meta = PRESS_SHOTS.map(({ name, caption }) => {
    const path = join(root, SCREENSHOTS_DIR, `${name}.png`)
    const png = readFileSync(path)
    let size: { width: number; height: number }
    try {
      size = pngSize(png)
    } catch (error) {
      throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      })
    }
    const file = `press/${name}.png`
    files.set(file, png)
    return { file: `/${file}`, caption, bytes: png.length, ...size }
  })
  return { meta, files }
}

export interface SiteContent {
  manifest: ContentManifest
  changelog: ChangelogContent
  docs: LoadedDoc[]
  /** Every generated file, keyed by its site path without the leading slash. */
  files: Record<string, string>
  /** Binary files (press screenshots), keyed the same way. */
  binaries: Map<string, Buffer>
}

export function computeContent(root: string, siteUrl?: string): SiteContent {
  const changelog = parseChangelog(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'))
  const docs = loadDocs(root)
  const press = loadPressShots(root)
  const files: Record<string, string> = {
    'content/changelog.json': JSON.stringify(changelog),
    'changelog.xml': buildRss(changelog, siteUrl),
  }
  for (const doc of docs) files[`content/docs/${doc.meta.slug}.json`] = JSON.stringify(doc.body)
  const hash = createHash('sha256')
  for (const [name, body] of Object.entries(files)) hash.update(name).update(body)
  for (const [name, body] of press.files) hash.update(name).update(body)
  const manifest: ContentManifest = {
    version: hash.digest('hex').slice(0, 10),
    docs: docs.map((doc) => doc.meta),
    releases: changelog.releases.map(({ version, date, id }) => ({ version, date, id })),
    press: press.meta,
  }
  return { manifest, changelog, docs, files, binaries: press.files }
}

export function contentPlugin(): Plugin {
  let root = process.cwd()
  let siteUrl: string | undefined
  return {
    name: 'squash-content',
    configResolved(config) {
      root = config.root
      siteUrl = typeof config.env.VITE_SITE_URL === 'string' ? config.env.VITE_SITE_URL : undefined
    },
    resolveId(id) {
      return id === CONTENT_MODULE_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(join(root, 'CHANGELOG.md'))
      for (const name of readdirSync(join(root, DOCS_DIR))) {
        this.addWatchFile(join(root, DOCS_DIR, name))
      }
      for (const shot of PRESS_SHOTS) {
        this.addWatchFile(join(root, SCREENSHOTS_DIR, `${shot.name}.png`))
      }
      return `export default ${JSON.stringify(computeContent(root, siteUrl).manifest)}`
    },
    generateBundle() {
      const { files, binaries } = computeContent(root, siteUrl)
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source })
      }
      for (const [fileName, source] of binaries) {
        this.emitFile({ type: 'asset', fileName, source: new Uint8Array(source) })
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\//, '')
        const generated =
          path === 'changelog.xml' || path.startsWith('content/') || path.startsWith('press/')
        if (!generated) return next()
        const { files, binaries } = computeContent(root, siteUrl)
        const binary = binaries.get(path)
        if (binary) {
          res.setHeader('Content-Type', 'image/png')
          res.end(binary)
          return
        }
        const body = files[path]
        if (body === undefined) return next()
        res.setHeader(
          'Content-Type',
          path.endsWith('.xml') ? 'application/rss+xml; charset=utf-8' : 'application/json',
        )
        res.end(body)
      })
    },
  }
}
