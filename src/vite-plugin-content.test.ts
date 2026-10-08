import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS_MARKER,
  buildRss,
  computeContent,
  parseChangelog,
  parseDoc,
  renderInline,
  renderMarkdown,
} from '../vite-plugin-content'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SAMPLE = `# Changelog

## Unreleased

### Added

- A pricing page.

## v1.1.0 — 2026-10-02

Context on every bug & editable comments.

### Fixed

- **Needs migration \`0007_bug_context.sql\`.** Run it after \`0001\`.
- Press <kbd>Esc</kbd> to cancel.

## v1.0.0 — 2026-10-01

Initial release of Squash.

- Shared workspaces.
`

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  expect(document.querySelector('parsererror')).toBeNull()
  return document
}

describe('Markdown rendering', () => {
  it('escapes HTML except <kbd>, and keeps code spans literal', () => {
    expect(renderInline('<script>alert(1)</script> <kbd>K</kbd>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; <kbd>K</kbd>',
    )
    expect(renderInline('`**not bold** <b>`')).toBe('<code>**not bold** &lt;b&gt;</code>')
    expect(renderInline('**Needs `0007.sql`.**')).toBe(
      '<strong>Needs <code>0007.sql</code>.</strong>',
    )
  })

  it('only keeps safe link targets', () => {
    expect(renderInline('[docs](/docs/capture)')).toBe('<a href="/docs/capture">docs</a>')
    expect(renderInline('[site](https://supabase.com)')).toBe(
      '<a href="https://supabase.com" rel="noreferrer">site</a>',
    )
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('href')
    expect(renderInline('[x](//evil.example)')).not.toContain('href')
  })

  it('renders headings with permalinks, lists, tables and fenced code', () => {
    const { html, headings } = renderMarkdown(
      [
        '## Sign in',
        '',
        'Paragraph one',
        'continues here.',
        '',
        '- a',
        '- b',
        '',
        '| Key | Action |',
        '| --- | ------ |',
        '| <kbd>N</kbd> | New bug |',
        '',
        '```sh',
        'npm ci && echo "<ok>"',
        '```',
        '',
        '## Sign in',
      ].join('\n'),
    )
    expect(headings).toEqual([
      { id: 'sign-in', text: 'Sign in', level: 2 },
      { id: 'sign-in-2', text: 'Sign in', level: 2 },
    ])
    expect(html).toContain('<h2 id="sign-in">Sign in<a class="anchor" href="#sign-in"')
    expect(html).toContain('<p>Paragraph one continues here.</p>')
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>')
    expect(html).toContain('<th scope="col">Key</th>')
    expect(html).toContain('<td><kbd>N</kbd></td>')
    expect(html).toContain(
      '<pre data-lang="sh"><code>npm ci &amp;&amp; echo &quot;&lt;ok&gt;&quot;</code></pre>',
    )
  })

  it('passes the shortcut-table marker through untouched', () => {
    expect(renderMarkdown(`Intro\n\n${SHORTCUTS_MARKER}\n\nOutro`).html).toBe(
      `<p>Intro</p>\n${SHORTCUTS_MARKER}\n<p>Outro</p>`,
    )
  })
})

describe('Changelog', () => {
  it('labels Unreleased separately and anchors each release on its version', () => {
    const changelog = parseChangelog(SAMPLE)
    expect(changelog.unreleased?.empty).toBe(false)
    expect(changelog.unreleased?.html).toContain('<li>A pricing page.</li>')
    expect(changelog.releases.map((r) => [r.id, r.date])).toEqual([
      ['v1.1.0', '2026-10-02'],
      ['v1.0.0', '2026-10-01'],
    ])
    const [latest, first] = changelog.releases
    expect(latest.summary).toBe('Context on every bug &amp; editable comments.')
    expect(latest.html).toContain('<h3>Fixed</h3>')
    expect(latest.html).toContain(
      '<strong>Needs migration <code>0007_bug_context.sql</code>.</strong>',
    )
    // Repeated "Added"/"Fixed" headings must not produce duplicate ids on one page.
    expect(latest.html).not.toContain('id=')
    expect(first.summary).toBe('Initial release of Squash.')
    expect(first.html).toBe('<ul><li>Shared workspaces.</li></ul>')
  })

  it('treats an empty Unreleased section as empty', () => {
    const changelog = parseChangelog('## Unreleased\n\n## v1.0.0 — 2026-10-01\n\n- x\n')
    expect(changelog.unreleased).toEqual({ html: '', empty: true })
    expect(changelog.releases[0].summary).toBeNull()
  })

  it('refuses headings it does not understand', () => {
    expect(() => parseChangelog('## v1.0 — someday\n')).toThrow(/unexpected section heading/)
    expect(() => parseChangelog('## Unreleased\n')).toThrow(/no "## vX.Y.Z/)
  })

  it('builds a valid RSS 2.0 feed of tagged releases with permalinks', () => {
    const xml = buildRss(parseChangelog(SAMPLE), 'https://squash.example/')
    const document = parseXml(xml)
    expect(document.documentElement.getAttribute('version')).toBe('2.0')
    expect(document.querySelector('channel > link')?.textContent).toBe(
      'https://squash.example/changelog',
    )
    const items = [...document.querySelectorAll('item')]
    // Unreleased has no date and is not in the feed.
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('title')?.textContent).toBe(
      'Squash v1.1.0: Context on every bug & editable comments.',
    )
    expect(items[0].querySelector('link')?.textContent).toBe(
      'https://squash.example/changelog#v1.1.0',
    )
    expect(items[0].querySelector('guid')?.getAttribute('isPermaLink')).toBe('true')
    expect(items[0].querySelector('pubDate')?.textContent).toBe('Fri, 02 Oct 2026 12:00:00 GMT')
    // The HTML body is carried as escaped text and round-trips intact.
    expect(items[0].querySelector('description')?.textContent).toContain(
      '<li><strong>Needs migration <code>0007_bug_context.sql</code>.</strong>',
    )
  })

  it('generates the feed and JSON for the real CHANGELOG.md', () => {
    const { files, manifest, changelog } = computeContent(root, 'https://squash.example')
    const document = parseXml(files['changelog.xml'])
    const released = [
      ...readFileSync(join(root, 'CHANGELOG.md'), 'utf8').matchAll(/^## (v\d+\.\d+\.\d+) — /gm),
    ].map((m) => m[1])
    expect([...document.querySelectorAll('item > link')].map((link) => link.textContent)).toEqual(
      released.map((v) => `https://squash.example/changelog#${v}`),
    )
    expect(manifest.releases.map((r) => r.version)).toEqual(released)
    expect(JSON.parse(files['content/changelog.json'])).toEqual(changelog)
  })
})

describe('Docs', () => {
  it('needs complete front matter', () => {
    expect(() => parseDoc('x', '---\ntitle: X\n---\nBody')).toThrow(/missing "description"/)
    expect(() =>
      parseDoc('x', '---\ntitle: X\ndescription: d\ngroup: Other\norder: 1\n---\nBody'),
    ).toThrow(/group/)
  })

  it('ships one JSON body per docs/site page, in order, with headings for the outline', () => {
    const { files, manifest } = computeContent(root)
    const slugs = readdirSync(join(root, 'docs/site')).map((name) => name.replace(/\.md$/, ''))
    expect(manifest.docs.map((doc) => doc.slug).sort()).toEqual(slugs.sort())
    const orders = manifest.docs.map((doc) => doc.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    for (const doc of manifest.docs) {
      const body = JSON.parse(files[`content/docs/${doc.slug}.json`]) as { html: string }
      expect(body.html.length).toBeGreaterThan(0)
      for (const heading of doc.headings) expect(body.html).toContain(`id="${heading.id}"`)
    }
    expect(manifest.docs[0].slug).toBe('getting-started')
    expect(files['content/docs/keyboard.json']).toContain(SHORTCUTS_MARKER)
    // A new hash whenever any generated file changes.
    expect(manifest.version).toMatch(/^[0-9a-f]{10}$/)
  })
})
