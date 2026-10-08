import type { ReactNode } from 'react'
import { MENTION_CHAR } from './mention'

const MENTION_RE = new RegExp(`^@${MENTION_CHAR.source}+`, 'u')
import { cn } from './utils'

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw)
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const isWord = (ch: string | undefined) => ch !== undefined && /\w/.test(ch)

const LINK_CLASS = 'text-accent underline underline-offset-2 break-all'

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
      {children}
    </a>
  )
}

function closing(text: string, marker: string, from: number): number {
  let at = text.indexOf(marker, from)
  while (at !== -1 && at === from) at = text.indexOf(marker, at + 1)
  if (marker === '**' && at !== -1 && text[at + 2] === '*') {
    const lone = text.slice(from, at).replaceAll('**', '').split('*').length - 1
    if (lone % 2 === 1) at++
  }
  return at
}

/** Inline code up to this many characters never wraps, so `z-index` never splits at its hyphen. */
const NOWRAP_CODE_MAX = 32

/**
 * Inline code is mono and kept on one line. A longer span (a path, a long call) could not fit a
 * phone column, so it wraps anywhere inside its own box instead of overflowing the text.
 */
function inlineCodeClass(code: string): string {
  // A visible chip in both themes (surface-3 plus a hairline); tight side padding so a following
  // full stop does not read as if a space came before it.
  return `rounded-xs border border-line bg-surface-3 px-[3px] py-px font-mono text-xs ${
    [...code].length <= NOWRAP_CODE_MAX ? 'whitespace-nowrap' : '[overflow-wrap:anywhere]'
  }`
}

/** Inline constructs: code, bold, italic, links, @mentions and #123 refs. Unclosed markers stay literal. */
// eslint-disable-next-line react-refresh/only-export-components -- frozen contract exports a helper beside the component
export function renderInline(text: string): ReactNode[] {
  return inline(text, false)
}

function inline(text: string, inLink: boolean): ReactNode[] {
  const out: ReactNode[] = []
  let buf = ''
  let key = 0
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  const push = (node: ReactNode) => {
    flush()
    out.push(node)
  }

  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const rest = text.slice(i)
    const prev = text[i - 1]

    if (ch === '`') {
      const run = /^`+/.exec(rest)![0]
      const end = text.indexOf(run, i + run.length)
      if (end === -1) {
        buf += run
        i += run.length
        continue
      }
      {
        const code = text.slice(i + run.length, end)
        push(
          <code key={key++} className={inlineCodeClass(code)}>
            {code}
          </code>,
        )
        i = end + run.length
        continue
      }
    }

    if (rest.startsWith('**')) {
      const end = closing(text, '**', i + 2)
      if (end !== -1) {
        push(
          <strong key={key++} className="font-semibold">
            {inline(text.slice(i + 2, end), inLink)}
          </strong>,
        )
        i = end + 2
        continue
      }
      buf += '**'
      i += 2
      continue
    }

    if ((ch === '*' || ch === '_') && !(ch === '_' && isWord(prev))) {
      const end = closing(text, ch, i + 1)
      const inner = end === -1 ? '' : text.slice(i + 1, end)
      if (
        end !== -1 &&
        inner.trim() &&
        !/^\s/.test(inner) &&
        !(ch === '_' && isWord(text[end + 1]))
      ) {
        push(<em key={key++}>{inline(inner, inLink)}</em>)
        i = end + 1
        continue
      }
    }

    if (ch === '[' && !inLink) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)
      if (m) {
        const href = safeHref(m[2])
        if (href) {
          push(
            <Link key={key++} href={href}>
              {inline(m[1], true)}
            </Link>,
          )
        } else {
          buf += m[0]
        }
        i += m[0].length
        continue
      }
    }

    if (ch === 'h' && !inLink && !isWord(prev)) {
      const m = /^https?:\/\/[^\s<>]+/.exec(rest)
      if (m) {
        const url = m[0].replace(/[.,;:!?)\]'"]+$/, '')
        const href = safeHref(url)
        if (href) {
          push(
            <Link key={key++} href={href}>
              {url}
            </Link>,
          )
          i += url.length
          continue
        }
      }
    }

    if (ch === '@' && !isWord(prev)) {
      const m = MENTION_RE.exec(rest)
      if (m) {
        const name = m[0].replace(/[.-]+$/, '')
        if (name.length > 1) {
          push(
            <span key={key++} className="font-medium text-accent">
              {name}
            </span>,
          )
          i += name.length
          continue
        }
      }
    }

    if (ch === '#' && !isWord(prev)) {
      const m = /^#\d+/.exec(rest)
      if (m) {
        push(
          <span key={key++} className="font-mono text-xs text-muted">
            {m[0]}
          </span>,
        )
        i += m[0].length
        continue
      }
    }

    buf += ch
    i++
  }
  flush()
  return out
}

const BULLET = /^\s*[-*]\s+(.*)$/
const ORDERED = /^\s*\d+\.\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const FENCE = /^\s*```/

function lines(text: string): ReactNode[] {
  const out: ReactNode[] = []
  text.split('\n').forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`br${idx}`} />)
    out.push(...renderInline(line))
  })
  return out
}

function renderBlocks(source: string): ReactNode[] {
  const rows = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < rows.length) {
    const row = rows[i]

    if (!row.trim()) {
      i++
      continue
    }

    if (FENCE.test(row)) {
      const close = rows.findIndex((r, idx) => idx > i && FENCE.test(r))
      if (close !== -1) {
        blocks.push(
          <pre
            key={key++}
            className="overflow-x-auto rounded-md bg-bg-subtle p-3 font-mono text-xs"
          >
            <code>{rows.slice(i + 1, close).join('\n')}</code>
          </pre>,
        )
        i = close + 1
        continue
      }
    }

    const listPattern = BULLET.test(row) ? BULLET : ORDERED.test(row) ? ORDERED : null
    if (listPattern) {
      const items: string[] = []
      while (i < rows.length && listPattern.test(rows[i])) {
        items.push(listPattern.exec(rows[i])![1])
        i++
      }
      const Tag = listPattern === BULLET ? 'ul' : 'ol'
      blocks.push(
        <Tag
          key={key++}
          className={cn('space-y-0.5 pl-5', Tag === 'ul' ? 'list-disc' : 'list-decimal')}
        >
          {items.map((item, n) => (
            <li key={n}>{renderInline(item)}</li>
          ))}
        </Tag>,
      )
      continue
    }

    if (QUOTE.test(row)) {
      const quoted: string[] = []
      while (i < rows.length && QUOTE.test(rows[i])) {
        quoted.push(QUOTE.exec(rows[i])![1])
        i++
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-border pl-3 text-muted">
          {lines(quoted.join('\n'))}
        </blockquote>,
      )
      continue
    }

    const para: string[] = []
    while (
      i < rows.length &&
      rows[i].trim() &&
      !(
        para.length > 0 &&
        (FENCE.test(rows[i]) ||
          BULLET.test(rows[i]) ||
          ORDERED.test(rows[i]) ||
          QUOTE.test(rows[i]))
      )
    ) {
      para.push(rows[i])
      i++
    }
    blocks.push(<p key={key++}>{lines(para.join('\n'))}</p>)
  }
  return blocks
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed break-words', className)}>
      {renderBlocks(source)}
    </div>
  )
}
