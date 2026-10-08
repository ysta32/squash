import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { AlertCircle, ChevronsLeftRight } from 'lucide-react'
import { useSignedUrlState } from '../hooks/useSignedUrl'
import type { BugAttachment } from '../lib/types'
import { cn } from '../lib/utils'

export interface BeforeAfterProps {
  before: BugAttachment
  after: BugAttachment
  /** Frame size (aspect ratio and max width), shared with the loading placeholder. */
  frameStyle: CSSProperties
  /** Accessible name of the slider, e.g. "Before and after fix e3f9a12". */
  label: string
}

const STEP = 5
const PAGE = 25

const clamp = (n: number) => Math.min(100, Math.max(0, n))

type ImageState = 'loading' | 'loaded' | 'error'

/**
 * Load state of one image, keyed by its URL so a re-signed URL starts over. A cached image may
 * already be complete before React sees its load event, so the ref checks that too.
 */
function useImageState(url: string | null) {
  const [state, setState] = useState<{ url: string; status: ImageState } | null>(null)
  const status: ImageState = url && state?.url === url ? state.status : 'loading'
  const set = (next: ImageState) => {
    if (url) setState((s) => (s?.url === url && s.status === next ? s : { url, status: next }))
  }
  return {
    status,
    props: {
      onLoad: () => set('loaded'),
      onError: () => set('error'),
      ref: (img: HTMLImageElement | null) => {
        if (img?.complete && img.naturalWidth > 0) set('loaded')
      },
    },
  }
}

/**
 * The before/after comparison (DESIGN.md section 2a, proof of fix): the "after" screenshot sits
 * under the "before" one, which is clipped to the slider position. Only clip-path and transform
 * change; the move transitions for clicks and keys but not while dragging, and is instant under
 * reduced motion. A skeleton covers it until both images have loaded; if either cannot be signed
 * or loaded it says so inline, with links to whichever image is reachable.
 */
export default function BeforeAfter({ before, after, frameStyle, label }: BeforeAfterProps) {
  const beforeUrl = useSignedUrlState(before.storage_path)
  const afterUrl = useSignedUrlState(after.storage_path)
  const beforeImg = useImageState(beforeUrl.url)
  const afterImg = useImageState(afterUrl.url)
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)
  /** The one pointer driving the drag; other pointers (a second finger) are ignored. */
  const pointerRef = useRef<number | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const failed =
    beforeUrl.failed ||
    afterUrl.failed ||
    beforeImg.status === 'error' ||
    afterImg.status === 'error'
  const ready = !failed && beforeImg.status === 'loaded' && afterImg.status === 'loaded'
  const shown = Math.round(pos)

  function fromPointer(clientX: number): number {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return pos
    return clamp(((clientX - rect.left) / rect.width) * 100)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!ready || e.button !== 0 || pointerRef.current !== null) return
    pointerRef.current = e.pointerId
    // Keeps the drag on the frame even when the pointer leaves it; jsdom has no pointer capture.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragging(true)
    setPos(fromPointer(e.clientX))
    handleRef.current?.focus({ preventScroll: true })
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId === pointerRef.current) setPos(fromPointer(e.clientX))
  }

  /** pointerup, pointercancel and lostpointercapture of the active pointer all end the drag. */
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerRef.current) return
    pointerRef.current = null
    if (e.type !== 'lostpointercapture' && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragging(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next: Record<string, number> = {
      ArrowLeft: pos - STEP,
      ArrowDown: pos - STEP,
      ArrowRight: pos + STEP,
      ArrowUp: pos + STEP,
      PageDown: pos - PAGE,
      PageUp: pos + PAGE,
      Home: 0,
      End: 100,
    }
    if (!(e.key in next)) return
    e.preventDefault()
    setPos(clamp(Math.round(next[e.key])))
  }

  if (failed) {
    const links = [
      { name: 'before', url: beforeImg.status === 'error' ? null : beforeUrl.url },
      { name: 'after', url: afterImg.status === 'error' ? null : afterUrl.url },
    ].filter((l): l is { name: string; url: string } => l.url !== null)
    return (
      <div
        role="alert"
        style={{ maxWidth: frameStyle.maxWidth }}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-2 bg-surface-1 px-4 py-3 text-sm text-danger"
      >
        <AlertCircle size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
        <span className="min-w-0">Couldn't load the screenshots to compare.</span>
        {links.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded-xs font-medium text-ink underline decoration-line-input underline-offset-2 hover:decoration-ink"
          >
            Open {l.name}
          </a>
        ))}
      </div>
    )
  }

  const motion = dragging
    ? 'transition-none'
    : 'transition-[clip-path,transform] duration-(--dur-standard) ease-(--ease-out) motion-reduce:transition-none'

  return (
    <div
      ref={frameRef}
      style={frameStyle}
      aria-busy={!ready}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      className={cn(
        'relative w-full touch-pan-y overflow-hidden rounded-lg bg-surface-3 shadow-elev-3 select-none',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--border-1)]',
        ready && 'cursor-ew-resize',
      )}
    >
      {/* The images mount as soon as they are signed (so they load) but stay hidden until both have. */}
      <div className={cn('absolute inset-0', !ready && 'invisible')}>
        {afterUrl.url && (
          <img
            src={afterUrl.url}
            alt="After the fix"
            draggable={false}
            {...afterImg.props}
            className="absolute inset-0 h-full w-full object-cover object-left-top"
          />
        )}
        <span className={cn(CHIP, 'right-2')}>After</span>
        <div
          className={cn('absolute inset-0', motion)}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {beforeUrl.url && (
            <img
              src={beforeUrl.url}
              alt="Before the fix"
              draggable={false}
              {...beforeImg.props}
              className="absolute inset-0 h-full w-full object-cover object-left-top"
            />
          )}
          <span className={cn(CHIP, 'left-2')}>Before</span>
        </div>
        {ready && (
          // Full-width layer moved by transform: translateX(pos%) of the frame's own width.
          <div
            className={cn('pointer-events-none absolute inset-0', motion)}
            style={{ transform: `translateX(${pos}%)` }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-surface-2 shadow-[0_0_0_1px_var(--border-2)]"
            />
            <div
              ref={handleRef}
              role="slider"
              tabIndex={0}
              aria-label={label}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown}
              aria-valuetext={`${shown}% before, ${100 - shown}% after`}
              onKeyDown={onKeyDown}
              className="t focus-ring pointer-events-auto absolute top-1/2 left-0 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-line-2 bg-surface-2 text-ink shadow-elev-2 pointer-coarse:h-11 pointer-coarse:w-11"
            >
              <ChevronsLeftRight
                size={16}
                strokeWidth={1.5}
                absoluteStrokeWidth
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>
      {!ready && (
        <span
          role="status"
          aria-label="Loading the before and after screenshots"
          className="absolute inset-0 animate-skeleton bg-surface-3"
        />
      )}
    </div>
  )
}

const CHIP =
  'specimen-label pointer-events-none absolute top-2 rounded-xs border border-line-2 bg-surface-2 px-1.5 py-0.5 text-ink shadow-elev-1'
