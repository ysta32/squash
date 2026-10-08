import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { LIST_WIDTH } from '../lib/listWidth'
import { cn } from '../lib/utils'

const STEP = 8
const BIG_STEP = 40

/**
 * The 1px rule between list and detail, doubling as a resize handle: drag it, or focus it and use
 * the arrow keys (Shift for bigger steps), Home / End for the bounds; double-click resets. The
 * hit area is about 8px wide; the visible rule is 1px and becomes a 2px accent line on hover or drag.
 */
export function PaneSplitter({
  width,
  onWidth,
  controls,
  className,
}: {
  width: number
  onWidth: (width: number, commit?: boolean) => void
  /** id of the pane being resized. */
  controls: string
  className?: string
}) {
  const drag = useRef<{ x: number; width: number; pointer: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { x: event.clientX, width, pointer: event.pointerId }
    setDragging(true)
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.pointer !== event.pointerId) return
    onWidth(start.width + event.clientX - start.x, false)
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.pointer !== event.pointerId) return
    drag.current = null
    setDragging(false)
    onWidth(start.width + event.clientX - start.x, true)
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? BIG_STEP : STEP
    const next =
      event.key === 'ArrowLeft'
        ? width - step
        : event.key === 'ArrowRight'
          ? width + step
          : event.key === 'Home'
            ? LIST_WIDTH.min
            : event.key === 'End'
              ? LIST_WIDTH.max
              : null
    if (next === null) return
    event.preventDefault()
    onWidth(next)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize bug list"
      aria-controls={controls}
      aria-valuemin={LIST_WIDTH.min}
      aria-valuemax={LIST_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize; double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onWidth(LIST_WIDTH.initial)}
      onKeyDown={onKeyDown}
      className={cn(
        'group/split relative z-10 w-px cursor-col-resize touch-none bg-line outline-none select-none',
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 -right-1 -left-1" />
      <span
        aria-hidden="true"
        className={cn(
          // Idle: the 1px rule. Hover (after a beat, so passing over it stays calm), focus or drag:
          // a 2px accent line centred on the rule.
          't absolute inset-y-0 -left-[0.5px] w-[2px] bg-accent opacity-0 group-hover/split:opacity-100 group-hover/split:delay-150 group-focus-visible/split:bg-focus group-focus-visible/split:opacity-100',
          dragging && 'opacity-100 delay-0!',
        )}
      />
    </div>
  )
}
