import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../lib/utils'

export interface LightboxProps {
  urls: string[]
  index: number
  onClose: () => void
  onIndex: (index: number) => void
}

export function Lightbox({ urls, index, onClose, onIndex }: LightboxProps) {
  const count = urls.length
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white tabular-nums">
        {safeIndex + 1} / {count}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-3 right-3 z-10 rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="h-5 w-5" />
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
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next screenshot"
            onClick={(e) => {
              e.stopPropagation()
              onIndex((safeIndex + 1) % count)
            }}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <ZoomImage
        key={`${safeIndex}:${url}`}
        url={url}
        alt={`Screenshot ${safeIndex + 1} of ${count}`}
      />
    </div>,
    document.body,
  )
}

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
        'max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-150 select-none',
        zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
      )}
    />
  )
}
