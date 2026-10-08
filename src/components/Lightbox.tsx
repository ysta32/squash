import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn } from '../lib/utils'
import { AnnotationOverlay } from './AnnotationOverlay'

/** Live markup layers to draw over one screenshot, with its natural size. */
export interface LightboxMarkup {
  annotations: unknown
  width: number
  height: number
}

export interface LightboxProps {
  urls: string[]
  index: number
  onClose: () => void
  onIndex: (index: number) => void
  /** Per-image caption details (e.g. `1600×1000 · checkout.png`), aligned with `urls`. */
  captions?: (string | null)[]
  /** Per-image markup layers, aligned with `urls`. */
  markup?: (LightboxMarkup | null)[]
}

export function Lightbox({ urls, index, onClose, onIndex, captions, markup }: LightboxProps) {
  const count = urls.length
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, count > 0)
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1)

  // Latest callbacks/values for the window listener without re-subscribing every render.
  const stateRef = useRef({ count, safeIndex, onClose, onIndex })
  useEffect(() => {
    stateRef.current = { count, safeIndex, onClose, onIndex }
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = stateRef.current
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        s.onClose()
      } else if (e.key === 'ArrowLeft' && s.count > 1) {
        e.preventDefault()
        e.stopPropagation()
        s.onIndex((s.safeIndex - 1 + s.count) % s.count)
      } else if (e.key === 'ArrowRight' && s.count > 1) {
        e.preventDefault()
        e.stopPropagation()
        s.onIndex((s.safeIndex + 1) % s.count)
      }
    }
    // Capture phase so global shortcuts (Esc to deselect, arrows to move the list) don't also fire.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (count === 0) return null
  const url = urls[safeIndex]
  const caption = captions?.[safeIndex] ?? null
  // The last field of a `W×H · file name` caption is the file name.
  const cut = caption?.lastIndexOf(' · ') ?? -1
  const detail = caption && cut >= 0 ? caption.slice(0, cut) : caption
  const file = caption && cut >= 0 ? caption.slice(cut + 3) : null

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      // One dark glass scrim in both themes: a screenshot reads best on a dim surround.
      // Phones: the image runs edge to edge from just under the close button, with the caption
      // and then prev/next right under it, instead of a thin strip floating mid-screen.
      className="fixed inset-0 z-50 flex animate-fade flex-col items-center justify-center gap-4 bg-[rgb(12_12_10/0.72)] py-16 backdrop-blur-[14px] max-sm:justify-start max-sm:gap-3 max-sm:pt-[76px] max-sm:pb-6 sm:px-20"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        title="Close (Esc)"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className={cn(CHROME_BUTTON, 'top-4 right-4')}
      >
        <X size={20} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </button>
      <ZoomImage
        key={`${safeIndex}:${url}`}
        url={url}
        alt={`Screenshot ${safeIndex + 1} of ${count}`}
        markup={markup?.[safeIndex] ?? null}
      />
      <p
        onClick={(e) => e.stopPropagation()}
        className="max-w-full shrink-0 text-center font-mono max-sm:px-4 text-[12px] tracking-[0.06em] text-balance text-white/72 uppercase sm:truncate"
      >
        Fig.{' '}
        <span>
          {safeIndex + 1} / {count}
        </span>
        {/* A no-break space ties each dot to the field before it, so a wrapped line never starts
            with one. On phones the file name takes its own line, cut with an ellipsis. */}
        {detail && (
          <span className="normal-case [overflow-wrap:anywhere]">{`\u00a0· ${detail.replaceAll(' · ', '\u00a0· ')}`}</span>
        )}
        {file && (
          <>
            <span className="normal-case max-sm:hidden">{'\u00a0· '}</span>
            <span className="normal-case max-sm:block max-sm:truncate">{file}</span>
          </>
        )}
      </p>
      {count > 1 && (
        // Beside the image from `sm` up (positioned on the viewer); on phones a row in the flow
        // under the caption, in thumb reach and never over the screenshot.
        <div className="contents max-sm:flex max-sm:shrink-0 max-sm:gap-6">
          <button
            type="button"
            aria-label="Previous screenshot"
            onClick={(e) => {
              e.stopPropagation()
              onIndex((safeIndex - 1 + count) % count)
            }}
            title="Previous (←)"
            className={cn(CHROME_BUTTON, 'left-4', SIDE_NAV)}
          >
            <ChevronLeft size={20} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next screenshot"
            onClick={(e) => {
              e.stopPropagation()
              onIndex((safeIndex + 1) % count)
            }}
            title="Next (→)"
            className={cn(CHROME_BUTTON, 'right-4', SIDE_NAV)}
          >
            <ChevronRight size={20} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}

/** Prev/next: beside the image from `sm` up; on phones in the flow under the caption. */
const SIDE_NAV = 'max-sm:static sm:top-1/2 sm:-translate-y-1/2'

/** One control style in both themes, a true 44px: dark glass with a light hairline and white
 *  glyph, so it holds on the dark scrim and over a near-white screenshot when zoomed in. */
const CHROME_BUTTON =
  't focus-ring absolute z-10 inline-flex size-[44px] items-center justify-center rounded-full border border-white/30 bg-[rgb(12_12_10/0.78)] text-white shadow-elev-2 backdrop-blur-sm hover:border-white/55 hover:bg-[rgb(12_12_10/0.92)]'

/** Phones (Tailwind's `max-sm`): tap zooms into a natively scrollable, pannable image. */
function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(width < 40rem)').matches
}

function ZoomImage({
  url,
  alt,
  markup,
}: {
  url: string
  alt: string
  markup: LightboxMarkup | null
}) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  // Phone zoom: the image laid out at twice its fitted width, centred on the tapped point.
  const [pan, setPan] = useState<{ width: number; x: number; y: number } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!pan || !scroller) return
    scroller.scrollLeft = pan.x * scroller.scrollWidth - scroller.clientWidth / 2
    scroller.scrollTop = pan.y * scroller.scrollHeight - scroller.clientHeight / 2
  }, [pan])

  function pointAt(e: ReactMouseEvent<HTMLImageElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return { x: 0.5, y: 0.5 }
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    }
  }

  function originAt(e: ReactMouseEvent<HTMLImageElement>): string {
    const { x, y } = pointAt(e)
    return `${x * 100}% ${y * 100}%`
  }

  function onClick(e: ReactMouseEvent<HTMLImageElement>) {
    e.stopPropagation()
    if (pan) {
      setPan(null)
      return
    }
    if (!zoomed && isPhone()) {
      const width = e.currentTarget.getBoundingClientRect().width
      if (width > 0) {
        setPan({ width: width * 2, ...pointAt(e) })
        return
      }
    }
    if (!zoomed) setOrigin(originAt(e))
    setZoomed((z) => !z)
  }

  function onWheel(e: ReactWheelEvent<HTMLImageElement>) {
    if (pan) return
    if (e.deltaY < 0 && !zoomed) {
      setOrigin(originAt(e))
      setZoomed(true)
    } else if (e.deltaY > 0 && zoomed) {
      setZoomed(false)
    }
  }

  const zoomedIn = zoomed || pan !== null
  // The wrapper shrinks to the image, so the markup overlay covers exactly its pixels and
  // zooms with it. On a phone zoom the scroller pans it natively (both axes).
  return (
    <div
      ref={scrollerRef}
      className={cn(
        'relative min-h-0 max-w-full animate-dialog',
        pan && 'w-full shrink overflow-auto overscroll-contain',
      )}
    >
      <div
        style={
          pan
            ? { width: pan.width }
            : { transform: zoomed ? 'scale(2)' : 'scale(1)', transformOrigin: origin }
        }
        className={cn(
          'relative transition-transform duration-150',
          pan ? 'max-w-none' : 'max-w-full',
        )}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          onClick={onClick}
          onWheel={onWheel}
          className={cn(
            'block rounded-lg object-contain shadow-elev-3 select-none max-sm:rounded-none',
            pan
              ? 'h-auto w-full'
              : // Phones leave room under the image for the caption (two lines) and prev/next.
                'max-h-[calc(100dvh-10rem)] max-w-full max-sm:max-h-[calc(100dvh-236px)]',
            zoomedIn ? 'cursor-zoom-out' : 'cursor-zoom-in',
          )}
        />
        {markup && (
          <AnnotationOverlay
            annotations={markup.annotations}
            width={markup.width}
            height={markup.height}
          />
        )}
      </div>
    </div>
  )
}
