import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn } from '../lib/utils'

export interface LightboxProps {
  urls: string[]
  index: number
  onClose: () => void
  onIndex: (index: number) => void
  /** Per-image caption details (e.g. `1600×1000 · checkout.png`), aligned with `urls`. */
  captions?: (string | null)[]
}

export function Lightbox({ urls, index, onClose, onIndex, captions }: LightboxProps) {
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

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      // One dark glass scrim in both themes: a screenshot reads best on a dim surround.
      className="fixed inset-0 z-50 flex animate-fade flex-col items-center justify-center gap-4 bg-[rgb(12_12_10/0.72)] px-4 py-16 backdrop-blur-[14px] sm:px-20"
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
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous screenshot"
            onClick={(e) => {
              e.stopPropagation()
              onIndex((safeIndex - 1 + count) % count)
            }}
            title="Previous (←)"
            className={cn(CHROME_BUTTON, 'top-1/2 left-4 -translate-y-1/2')}
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
            className={cn(CHROME_BUTTON, 'top-1/2 right-4 -translate-y-1/2')}
          >
            <ChevronRight size={20} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          </button>
        </>
      )}
      <ZoomImage
        key={`${safeIndex}:${url}`}
        url={url}
        alt={`Screenshot ${safeIndex + 1} of ${count}`}
      />
      <p
        onClick={(e) => e.stopPropagation()}
        className="max-w-full shrink-0 truncate text-center font-mono text-xs tracking-[0.06em] text-white/80 uppercase"
      >
        Fig.{' '}
        <span>
          {safeIndex + 1} / {count}
        </span>
        {caption && <span className="normal-case"> · {caption}</span>}
      </p>
    </div>,
    document.body,
  )
}

const CHROME_BUTTON =
  't focus-ring absolute z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2/90 text-ink shadow-elev-2 hover:bg-surface-2 hover:text-accent'

function ZoomImage({ url, alt }: { url: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')

  function originAt(e: ReactMouseEvent<HTMLImageElement>): string {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return '50% 50%'
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const clamp = (v: number) => Math.min(100, Math.max(0, v))
    return `${clamp(x)}% ${clamp(y)}%`
  }

  function onClick(e: ReactMouseEvent<HTMLImageElement>) {
    e.stopPropagation()
    if (!zoomed) setOrigin(originAt(e))
    setZoomed((z) => !z)
  }

  function onWheel(e: ReactWheelEvent<HTMLImageElement>) {
    if (e.deltaY < 0 && !zoomed) {
      setOrigin(originAt(e))
      setZoomed(true)
    } else if (e.deltaY > 0 && zoomed) {
      setZoomed(false)
    }
  }

  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      onClick={onClick}
      onWheel={onWheel}
      style={{ transform: zoomed ? 'scale(2)' : 'scale(1)', transformOrigin: origin }}
      className={cn(
        'max-h-[calc(100dvh-10rem)] max-w-full animate-dialog rounded-lg object-contain shadow-elev-3 transition-transform duration-150 select-none',
        zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
      )}
    />
  )
}
