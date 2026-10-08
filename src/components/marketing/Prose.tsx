import { Fragment, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Build-time HTML (vite-plugin-content.ts renders repository Markdown and escapes everything but
 * <kbd>) set in the reading style. Site-relative links navigate in the app instead of reloading.
 * `slots` replaces marker comments in the HTML with live components (the shortcut table).
 */
export function Prose({
  html,
  slots,
  className,
}: {
  html: string
  slots?: Record<string, ReactNode>
  className?: string
}) {
  const navigate = useNavigate()

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href || !href.startsWith('/') || href.startsWith('//')) return
    event.preventDefault()
    navigate(href)
  }

  const markers = Object.keys(slots ?? {})
  const parts = markers.length
    ? html.split(
        new RegExp(`(${markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`),
      )
    : [html]

  return (
    // Clicks bubble here from links inside the injected HTML; keyboard activation of a link
    // fires the same click event, so this is not mouse-only.
    <div className={cn('mk-prose', className)} onClick={onClick}>
      {parts.map((part, i) =>
        slots && part in slots ? (
          <Fragment key={i}>{slots[part]}</Fragment>
        ) : (
          <div key={i} className="contents" dangerouslySetInnerHTML={{ __html: part }} />
        ),
      )}
    </div>
  )
}
