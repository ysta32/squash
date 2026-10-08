import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  MAX_NOTE_LENGTH,
  MAX_SHAPES,
  drawAnnotations,
  flatten,
  nextPinNumber,
  parseShape,
  renumberPins,
  serializeAnnotations,
  type Annotations,
  type MarkupColor,
  type MarkupShape,
  type ShapeType,
} from '../lib/annotations'
import { Button, Kbd, Keys, MOD_KEY } from './ui'

interface AnnotateDialogProps {
  /** The unmarked image. */
  file: File
  /** Editable layers from an earlier session on the same image. */
  initialShapes?: readonly MarkupShape[]
  /**
   * Receives the flattened render and the vector layers (no shapes: every mark was removed, and
   * the file is the unmarked original). May reject with a user-facing Error; the dialog then
   * stays open with the marks intact.
   */
  onSave: (file: File, annotations: Annotations) => void | Promise<void>
  onClose: () => void
}

const tools: { tool: ShapeType; label: string; key: string }[] = [
  { tool: 'arrow', label: 'Arrow', key: 'A' },
  { tool: 'box', label: 'Box', key: 'B' },
  { tool: 'pen', label: 'Pen', key: 'P' },
  { tool: 'pin', label: 'Pin', key: 'N' },
]
const colors: { label: string; value: MarkupColor }[] = [
  { label: 'Danger', value: 'danger' },
  { label: 'Warning', value: 'warning' },
  { label: 'Success', value: 'success' },
  { label: 'Contrast', value: 'fg' },
]
const NO_SHAPES: readonly MarkupShape[] = []

function isTextField(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === 'text'
}

/** "Pin 2", "Box 1", ... per layer, in drawing order. */
function layerLabels(shapes: readonly MarkupShape[]): string[] {
  const counts = { arrow: 0, box: 0, pen: 0 }
  const names = { arrow: 'Arrow', box: 'Box', pen: 'Drawing' }
  return shapes.map((shape) =>
    shape.type === 'pin' ? `Pin ${shape.n}` : `${names[shape.type]} ${++counts[shape.type]}`,
  )
}

/** A drag in progress, in normalized coordinates. Committed through parseShape. */
function draftFrom(tool: ShapeType, color: MarkupColor, x: number, y: number): MarkupShape {
  switch (tool) {
    case 'arrow':
      return { type: 'arrow', color, x1: x, y1: y, x2: x, y2: y }
    case 'box':
      return { type: 'box', color, x, y, w: 0, h: 0 }
    case 'pen':
      return { type: 'pen', color, points: [[x, y]] }
    case 'pin':
      return { type: 'pin', color, n: 1, x, y }
  }
}

function extendDraft(shape: MarkupShape, x: number, y: number): MarkupShape {
  switch (shape.type) {
    case 'arrow':
      return { ...shape, x2: x, y2: y }
    case 'box':
      return { ...shape, w: x - shape.x, h: y - shape.y }
    case 'pen':
      return { ...shape, points: [...shape.points, [x, y]] }
    case 'pin':
      return shape
  }
}

function hasExtent(shape: MarkupShape): boolean {
  switch (shape.type) {
    case 'arrow':
      return shape.x1 !== shape.x2 || shape.y1 !== shape.y2
    case 'box':
      return shape.w !== 0 || shape.h !== 0
    case 'pen':
      return shape.points.some(([x, y]) => x !== shape.points[0][0] || y !== shape.points[0][1])
    case 'pin':
      return true
  }
}

export function AnnotateDialog({
  file,
  initialShapes = NO_SHAPES,
  onSave,
  onClose,
}: AnnotateDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<ShapeType>('arrow')
  const [color, setColor] = useState<MarkupColor>(colors[0].value)
  const [shapes, setShapes] = useState<MarkupShape[]>(() => [...initialShapes])
  const [draft, setDraft] = useState<MarkupShape | null>(null)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; shape: MarkupShape } | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(false)
  /** A just-placed pin whose note field should take focus once it renders. */
  const focusPinRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    const url = URL.createObjectURL(file)
    const loaded = new Image()
    loaded.onload = () => setImage(loaded)
    loaded.onerror = () => setError('Could not load this image.')
    loaded.src = url
    return () => {
      mountedRef.current = false
      loaded.onload = null
      loaded.onerror = null
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)
    drawAnnotations(ctx, draft ? [...shapes, draft] : shapes, canvas.width, canvas.height)
  }, [image, shapes, draft])

  // A new pin's note field takes focus so its checklist line can be typed straight away.
  useEffect(() => {
    const pin = focusPinRef.current
    if (pin === null) return
    focusPinRef.current = null
    dialogRef.current?.querySelector<HTMLInputElement>(`input[data-pin="${pin}"]`)?.focus()
  }, [shapes])

  const dirty = JSON.stringify(shapes) !== JSON.stringify(initialShapes)
  const canSave = dirty && (shapes.length > 0 || initialShapes.length > 0)
  const labels = layerLabels(shapes)

  function requestClose() {
    if (savingRef.current) return
    if (dragRef.current) {
      const pointerId = dragRef.current.pointerId
      cancelDrag()
      canvasRef.current?.releasePointerCapture(pointerId)
      return
    }
    if (dirty) setDiscard(true)
    else onClose()
  }

  function removeLayer(index: number) {
    if (savingRef.current || dragRef.current) return
    setShapes((previous) => renumberPins(previous.filter((_, i) => i !== index)))
  }

  function setNote(index: number, note: string) {
    setShapes((previous) =>
      previous.map((shape, i) =>
        i === index && shape.type === 'pin'
          ? { ...shape, note: note.slice(0, MAX_NOTE_LENGTH) }
          : shape,
      ),
    )
  }

  function undo() {
    if (savingRef.current || dragRef.current) return
    setShapes((previous) => renumberPins(previous.slice(0, -1)))
  }

  async function save() {
    if (!image || !canSave || dragRef.current || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const annotations = serializeAnnotations(shapes)
      if (annotations.shapes.length === 0) {
        // Every mark was removed: hand back the unmarked original.
        await onSave(file, annotations)
        if (mountedRef.current) onClose()
        return
      }
      const canvas = flatten(document.createElement('canvas'), image, annotations.shapes)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('Could not save the marked-up image. Please try again.'))
        }, 'image/png')
      })
      if (!mountedRef.current) return
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'
      await onSave(new File([blob], `${base}-marked.png`, { type: 'image/png' }), annotations)
      if (!mountedRef.current) return
      onClose()
    } catch (err) {
      if (mountedRef.current)
        setError(err instanceof Error ? err.message : 'Could not save the image.')
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing) return
    if (event.key === 'Tab') {
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input[type="text"]:not(:disabled)',
        ) ?? [],
      )
      event.preventDefault()
      event.stopPropagation()
      if (buttons.length === 0) {
        dialogRef.current?.focus()
        return
      }
      const index = buttons.indexOf(document.activeElement as HTMLElement)
      buttons[
        index < 0
          ? event.shiftKey
            ? buttons.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ].focus()
      return
    }
    const typing = isTextField(event.target)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // Leaving a pin note returns to the tools instead of closing the editor.
      if (typing) dialogRef.current?.focus()
      else requestClose()
      return
    }
    if (discard || savingRef.current) return
    const mod = event.metaKey || event.ctrlKey
    // Typing a note: letters, undo and plain Enter belong to the text field.
    if (typing && !(mod && event.key === 'Enter')) return
    if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      undo()
    } else if (
      event.key === 'Enter' &&
      (mod || !(event.target instanceof HTMLButtonElement) || event.target.dataset.tool)
    ) {
      event.preventDefault()
      event.stopPropagation()
      void save()
    } else if (!mod && !event.altKey) {
      const selected = tools.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase())
      if (selected) {
        event.preventDefault()
        event.stopPropagation()
        setTool(selected.tool)
      }
    }
  })

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector('button')?.focus()
    const listener = (event: KeyboardEvent) => onKey(event)
    window.addEventListener('keydown', listener, true)
    return () => {
      window.removeEventListener('keydown', listener, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLButtonElement>(discard ? '[data-keep-editing]' : '[data-tool]')
      ?.focus()
  }, [discard])

  /** The pointer position normalized to the image (0..1), clamped to its edges. */
  function pointAt(event: PointerEvent<HTMLCanvasElement>): [number, number] {
    const bounds = event.currentTarget.getBoundingClientRect()
    const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)
    return [
      clamp((event.clientX - bounds.left) / bounds.width),
      clamp((event.clientY - bounds.top) / bounds.height),
    ]
  }

  function extendDrag(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.shape = extendDraft(drag.shape, ...pointAt(event))
    setDraft(drag.shape)
  }

  function cancelDrag() {
    dragRef.current = null
    setDraft(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade items-center justify-center dialog-scrim p-3">
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={`Mark up ${file.name}`}
        className="flex max-h-full max-w-full animate-dialog flex-col gap-3 overflow-auto rounded-xl border border-line bg-surface-2 p-3 text-ink shadow-elev-3"
      >
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Annotation tools"
        >
          {tools.map((entry) => (
            <Button
              key={entry.tool}
              size="sm"
              data-tool={entry.tool}
              aria-pressed={tool === entry.tool}
              variant={tool === entry.tool ? 'primary' : 'secondary'}
              onClick={() => setTool(entry.tool)}
              disabled={saving || discard}
            >
              {entry.label} <Kbd>{entry.key}</Kbd>
            </Button>
          ))}
          {colors.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-label={entry.label}
              aria-pressed={color === entry.value}
              disabled={saving || discard}
              onClick={() => setColor(entry.value)}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-line-2 aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink pointer-coarse:h-[3.1429rem] pointer-coarse:w-[3.1429rem]"
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: `var(--${entry.value})` }}
              />
            </button>
          ))}
          <Button
            size="sm"
            onClick={undo}
            disabled={!shapes.length || !!draft || saving || discard}
          >
            Undo <Keys keys={[MOD_KEY, 'Z']} className="pointer-coarse:hidden" />
          </Button>
          <Button
            size="sm"
            onClick={() => setShapes([])}
            disabled={!shapes.length || !!draft || saving || discard}
          >
            Clear
          </Button>
        </div>
        {!image && !error && <p role="status">Loading image…</p>}
        <canvas
          ref={canvasRef}
          aria-label="Image annotation canvas"
          width={image?.naturalWidth ?? 0}
          height={image?.naturalHeight ?? 0}
          className="max-h-[80vh] max-w-[90vw] shrink-0 self-center rounded-lg object-contain shadow-elev-3"
          style={{ width: 'auto', height: 'auto', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(event) => {
            if (!image || saving || discard || dragRef.current || event.button !== 0) return
            event.preventDefault()
            if (shapes.length >= MAX_SHAPES) {
              setError(`Up to ${MAX_SHAPES} marks per image. Remove one to add another.`)
              return
            }
            const [x, y] = pointAt(event)
            if (tool === 'pin') {
              // A pin is placed with one click; its number is the next free one.
              const n = nextPinNumber(shapes)
              setShapes((previous) => [...previous, { type: 'pin', color, n, x, y }])
              focusPinRef.current = n
              return
            }
            event.currentTarget.setPointerCapture(event.pointerId)
            const shape = draftFrom(tool, color, x, y)
            dragRef.current = { pointerId: event.pointerId, shape }
            setDraft(shape)
          }}
          onPointerMove={extendDrag}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return
            extendDrag(event)
            const shape = dragRef.current.shape
            const committed = hasExtent(shape) ? parseShape(shape) : null
            if (committed) setShapes((previous) => [...previous, committed])
            cancelDrag()
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) cancelDrag()
          }}
          onLostPointerCapture={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) cancelDrag()
          }}
        />
        {shapes.length > 0 && (
          // The padding (cancelled by the margin) keeps the 2px + 2px-offset focus outline of a
          // note field or remove button inside the scroller, which would otherwise clip it.
          <ol
            aria-label="Layers"
            className="-m-1.5 flex max-h-40 flex-col gap-1 overflow-auto p-1.5 text-sm"
          >
            {shapes.map((shape, index) => (
              <li key={index} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--${shape.color})` }}
                />
                <span className="shrink-0 font-mono text-xs text-muted">{labels[index]}</span>
                {shape.type === 'pin' ? (
                  <input
                    type="text"
                    data-pin={shape.n}
                    value={shape.note ?? ''}
                    maxLength={MAX_NOTE_LENGTH}
                    placeholder="What is wrong here?"
                    aria-label={`Note for pin ${shape.n}`}
                    disabled={saving || discard}
                    onChange={(event) => setNote(index, event.target.value)}
                    className="focus-ring h-7 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm text-fg placeholder:text-muted"
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <button
                  type="button"
                  aria-label={`Remove ${labels[index]}`}
                  title={`Remove ${labels[index]}`}
                  disabled={saving || discard || !!draft}
                  onClick={() => removeLayer(index)}
                  className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg"
                >
                  <X size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {discard ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-sm">Discard changes?</p>
            <Button variant="destructive" onClick={onClose}>
              Discard
            </Button>
            <Button data-keep-editing onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={!image || !canSave || !!draft || saving}
            >
              {saving ? 'Saving…' : 'Use marked-up image'}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
