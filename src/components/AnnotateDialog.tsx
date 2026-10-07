import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { drawShapes, strokeWidthFor, type Point, type Shape, type Tool } from '../lib/annotate'
import { Button, Kbd } from './ui'

interface AnnotateDialogProps {
  file: File
  onSave: (file: File) => void
  onClose: () => void
}

const tools: { tool: Tool; label: string; key: string }[] = [
  { tool: 'arrow', label: 'Arrow', key: 'A' },
  { tool: 'box', label: 'Box', key: 'B' },
  { tool: 'pen', label: 'Pen', key: 'P' },
]
const colors = [
  { label: 'Danger', value: 'var(--danger)' },
  { label: 'Warning', value: 'var(--warning)' },
  { label: 'Success', value: 'var(--success)' },
  { label: 'Contrast', value: 'var(--fg)' },
]

export function AnnotateDialog({ file, onSave, onClose }: AnnotateDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(colors[0].value)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [draft, setDraft] = useState<Shape | null>(null)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; shape: Shape } | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(false)

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
    drawShapes(ctx, draft ? [...shapes, draft] : shapes)
  }, [image, shapes, draft])

  function requestClose() {
    if (savingRef.current) return
    if (shapes.length > 0 || dragRef.current) setDiscard(true)
    else onClose()
  }

  function undo() {
    if (savingRef.current || dragRef.current) return
    setShapes((previous) => previous.slice(0, -1))
  }

  async function save() {
    if (!image || shapes.length === 0 || dragRef.current || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not create the marked-up image.')
      ctx.drawImage(image, 0, 0)
      drawShapes(ctx, shapes)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('Could not save the marked-up image. Please try again.'))
        }, 'image/png')
      })
      if (!mountedRef.current) return
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'
      onSave(new File([blob], `${base}-marked.png`, { type: 'image/png' }))
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
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      )
      event.preventDefault()
      event.stopPropagation()
      if (buttons.length === 0) {
        dialogRef.current?.focus()
        return
      }
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[
        index < 0
          ? event.shiftKey
            ? buttons.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ].focus()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      requestClose()
      return
    }
    if (discard || savingRef.current) return
    const mod = event.metaKey || event.ctrlKey
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

  function pointAt(event: PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) * canvas.width) / bounds.width,
      y: ((event.clientY - bounds.top) * canvas.height) / bounds.height,
    }
  }

  function extendDrag(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointAt(event)
    drag.shape = {
      ...drag.shape,
      points:
        drag.shape.tool === 'pen' ? [...drag.shape.points, point] : [drag.shape.points[0], point],
    }
    setDraft(drag.shape)
  }

  function cancelDrag() {
    dragRef.current = null
    setDraft(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={`Mark up ${file.name}`}
        className="flex max-h-full max-w-full flex-col gap-3 overflow-auto rounded-xl border border-border bg-bg-elevated p-3 text-fg shadow-elevated"
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
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-border aria-pressed:border-accent aria-pressed:ring-2 aria-pressed:ring-accent"
            >
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: entry.value }} />
            </button>
          ))}
          <Button
            size="sm"
            onClick={undo}
            disabled={!shapes.length || !!draft || saving || discard}
          >
            Undo <Kbd>⌘/Ctrl Z</Kbd>
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
          className="max-h-[80vh] max-w-[90vw] shrink-0 self-center object-contain"
          style={{ width: 'auto', height: 'auto', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(event) => {
            if (!image || saving || discard || dragRef.current || event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            const shape: Shape = {
              tool,
              color,
              width: strokeWidthFor(image.naturalWidth),
              points: [pointAt(event)],
            }
            dragRef.current = { pointerId: event.pointerId, shape }
            setDraft(shape)
          }}
          onPointerMove={extendDrag}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return
            extendDrag(event)
            const shape = dragRef.current.shape
            if (
              shape.points.some(
                (point) => point.x !== shape.points[0].x || point.y !== shape.points[0].y,
              )
            )
              setShapes((previous) => [...previous, shape])
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
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {discard ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-sm">Discard changes?</p>
            <Button variant="danger" onClick={onClose}>
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
              disabled={!image || !shapes.length || !!draft || saving}
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
