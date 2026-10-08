import { collectEnvContext, extractUrl, sanitizeContext } from '../lib/bugContext'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { Camera, CircleAlert, ImagePlus, Info, Mic, Paperclip, X } from 'lucide-react'
import type { AttachmentMarkup, NewBugInput } from '../hooks/useBugs'
import { useSpeech } from '../hooks/useSpeech'
import { usePasteImage } from '../hooks/usePasteImage'
import { isOverlayOpen, isTypingTarget } from '../hooks/useKeyboard'
import { MAX_ORIGINAL_BYTES } from '../hooks/useImageCompression'
import { fitUnder } from '../lib/annotate'
import type { Annotations } from '../lib/annotations'
import { SEVERITIES } from '../lib/types'
import type { BugKind, Severity } from '../lib/types'
import { cn, isMac, randomId } from '../lib/utils'
import { AttachmentChip } from './AttachmentChip'
import { AnnotateDialog } from './AnnotateDialog'
import { SeverityPicker } from './SeverityPicker'
import { Kbd } from './ui'

const MAX_FILES = 10
/** Eight 24px lines; past that the textarea scrolls. */
const MAX_TEXTAREA_PX = 8 * 24

/** 44px touch targets on phones, 36px from `sm` up (44px again on coarse pointers). */
const ICON_BUTTON =
  't focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink sm:size-9 pointer-coarse:size-11'
const ICON = { size: 16, absoluteStrokeWidth: true, strokeWidth: 1.5, 'aria-hidden': true } as const

const ENTER_GLYPH = isMac ? '↵' : 'Enter'
const ENTER_NAME = isMac ? 'Return' : 'Enter'

const TOO_LARGE = 'Screenshot not added: the file is over 5 MB. Try a smaller crop.'
const TOO_MANY = `Up to ${MAX_FILES} screenshots per bug. The rest weren’t added.`

interface CaptureBarProps {
  workspaceId: string
  onSubmit: (input: NewBugInput) => Promise<void>
  /** What Enter files: a bug or a feature request. */
  kind?: BugKind
  onToast?: (m: string) => void
  focusRef?: RefObject<HTMLTextAreaElement | null>
}

interface Chip {
  id: string
  /** The image to upload: the flattened render when marked up. */
  file: File
  previewUrl: string
  /** Live markup layers over the unmarked original. */
  markup?: AttachmentMarkup
}

function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
}

export function CaptureBar({
  workspaceId,
  onSubmit,
  kind = 'bug',
  onToast,
  focusRef,
}: CaptureBarProps) {
  const noun = kind === 'feature' ? 'feature request' : 'bug'
  const [value, setValueState] = useState('')
  const [interim, setInterim] = useState('')
  const [removedUrls, setRemovedUrls] = useState<string[]>([])
  const removedUrlsRef = useRef<string[]>([])
  const detectedUrl = extractUrl(value)
  const contextUrl = detectedUrl && !removedUrls.includes(detectedUrl) ? detectedUrl : undefined

  const valueRef = useRef('')
  const transcriptRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const finalWaiter = useRef<(() => void) | null>(null)
  const setValue = (v: string) => {
    valueRef.current = v
    setValueState(v)
  }
  const setTranscript = (t: string | null) => {
    transcriptRef.current = t
  }
  const [severity, setSeverityState] = useState<Severity>('medium')
  const severityRef = useRef<Severity>('medium')
  const setSeverity = (s: Severity) => {
    severityRef.current = s
    setSeverityState(s)
  }
  const [chips, setChips] = useState<Chip[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const chipsRef = useRef<Chip[]>(chips)
  const [coarse] = useState(isCoarsePointer)
  const [focused, setFocused] = useState(false)
  const [filing, setFiling] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const setTextarea = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el
      if (focusRef) focusRef.current = el
    },
    [focusRef],
  )

  const speech = useSpeech({
    onFinal: (text) => {
      const t = text.trim()
      if (!t) return
      setInterim('')
      const v = valueRef.current
      setValue(v && !/\s$/.test(v) ? `${v} ${t}` : `${v}${t}`)
      setTranscript(transcriptRef.current ? `${transcriptRef.current} ${t}` : t)
      finalWaiter.current?.()
    },
    onInterim: setInterim,
  })

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    const needed = Math.max(el.scrollHeight, mirrorRef.current?.scrollHeight ?? 0)
    el.style.height = `${Math.min(needed, MAX_TEXTAREA_PX)}px`
  }, [value, interim])

  useEffect(() => {
    chipsRef.current = chips
  }, [chips])

  useEffect(
    () => () => {
      chipsRef.current.forEach((c) => URL.revokeObjectURL(c.previewUrl))
      chipsRef.current = []
    },
    [],
  )

  const removeUrl = () => {
    if (!contextUrl) return
    removedUrlsRef.current = [...removedUrlsRef.current, contextUrl]
    setRemovedUrls(removedUrlsRef.current)
    innerRef.current?.focus()
  }

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      const accepted: Chip[] = []
      let tooLarge = false
      let tooMany = false
      const room = MAX_FILES - chipsRef.current.length
      for (const file of images) {
        if (file.size > MAX_ORIGINAL_BYTES) {
          tooLarge = true
        } else if (accepted.length >= room) {
          tooMany = true
        } else {
          accepted.push({ id: randomId(), file, previewUrl: URL.createObjectURL(file) })
        }
      }
      const error = tooLarge ? TOO_LARGE : tooMany ? TOO_MANY : null
      setAttachError(error)
      // The bar is hidden on phones while a bug is open; its inline error would go unseen there.
      const bar = innerRef.current
      if (error && bar && typeof bar.checkVisibility === 'function' && !bar.checkVisibility()) {
        onToast?.(error)
      }
      if (accepted.length > 0) setChips((prev) => [...prev, ...accepted])
    },
    [onToast],
  )

  // Files dragged anywhere over the page drop into the bar (usePasteImage handles the drop), so the
  // bar shows the drop state for the whole drag. A depth count copes with nested enter/leave pairs.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth += 1
      setDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onEnd = () => {
      depth = 0
      setDragging(false)
    }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onEnd)
    document.addEventListener('dragend', onEnd)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onEnd)
      document.removeEventListener('dragend', onEnd)
    }
  }, [])

  // Screenshot → ⌘V anywhere → type: land the cursor at the end of the bar unless another field
  // has focus or an overlay is open.
  const onPasteFiles = useCallback(
    (files: File[]) => {
      addFiles(files)
      const el = innerRef.current
      if (!el || isTypingTarget(document.activeElement) || isOverlayOpen()) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    },
    [addFiles],
  )
  usePasteImage(onPasteFiles)

  const removeChip = (id: string) => {
    setAttachError(null)
    setChips((prev) => {
      const gone = prev.find((c) => c.id === id)
      if (gone) URL.revokeObjectURL(gone.previewUrl)
      return prev.filter((c) => c.id !== id)
    })
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  const flushSpeech = (): Promise<void> =>
    new Promise((resolve) => {
      const done = () => {
        finalWaiter.current = null
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, 300)
      finalWaiter.current = done
      speech.stop()
    })

  const submit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await runSubmit()
    } finally {
      submittingRef.current = false
      setFiling(false)
    }
  }

  const runSubmit = async () => {
    if (speech.listening) await flushSpeech()
    // Read everything from refs only after the flush: state may have changed during the wait.
    setInterim('')
    const description = valueRef.current.trim()
    if (!description) return
    const snapshot = {
      value: valueRef.current,
      transcript: transcriptRef.current,
      severity: severityRef.current,
      chips: chipsRef.current,
      removedUrls: removedUrlsRef.current,
    }
    const url = extractUrl(description)
    const context = sanitizeContext({
      ...collectEnvContext(),
      url: url && !snapshot.removedUrls.includes(url) ? url : undefined,
    })
    removedUrlsRef.current = []
    setRemovedUrls([])
    const files = snapshot.chips.map((c) => c.file)
    setValue('')
    setTranscript(null)
    setSeverity('medium')
    setChips([])
    setAttachError(null)
    setFiling(true)
    try {
      await onSubmit({
        description,
        context,
        transcript: snapshot.transcript,
        severity: snapshot.severity,
        kind,
        files,
        ...(snapshot.chips.some((c) => c.markup)
          ? { markup: snapshot.chips.map((c) => c.markup ?? null) }
          : {}),
      })
      snapshot.chips.forEach((c) => URL.revokeObjectURL(c.previewUrl))
    } catch (err) {
      removedUrlsRef.current = [...snapshot.removedUrls, ...removedUrlsRef.current]
      setRemovedUrls(removedUrlsRef.current)
      const current = valueRef.current
      setValue(current.trim() === '' ? snapshot.value : `${snapshot.value.trimEnd()}\n\n${current}`)
      if (snapshot.transcript) {
        setTranscript(
          transcriptRef.current
            ? `${snapshot.transcript} ${transcriptRef.current}`
            : snapshot.transcript,
        )
      }
      setSeverity(snapshot.severity)
      setChips((prev) => [...snapshot.chips, ...prev])
      onToast?.(err instanceof Error ? err.message : `Could not file ${noun}`)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault()
      setSeverity(SEVERITIES[Number(e.code.slice(5)) - 1])
      return
    }
    if (e.target !== innerRef.current) return
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  const saveMarkedUp = async (file: File, annotations: Annotations): Promise<void> => {
    if (annotations.shapes.length === 0) {
      // Every mark was removed: back to the unmarked original.
      const current = chipsRef.current.find((chip) => chip.id === editingId)
      if (!current) return
      const previewUrl = URL.createObjectURL(file)
      URL.revokeObjectURL(current.previewUrl)
      setChips((previous) =>
        previous.map((chip) => (chip.id === current.id ? { id: chip.id, file, previewUrl } : chip)),
      )
      return
    }
    try {
      file = await fitUnder(file, MAX_ORIGINAL_BYTES)
    } catch (error) {
      // Thrown back to the editor, which keeps the marks and shows the message.
      throw new Error(
        error instanceof Error && error.message === 'too-large'
          ? 'The marked-up image is too large to upload (max 5MB).'
          : error instanceof Error
            ? error.message
            : 'Could not save the marked-up image.',
        { cause: error },
      )
    }
    const current = chipsRef.current.find((chip) => chip.id === editingId)
    if (!current) return
    const previewUrl = URL.createObjectURL(file)
    URL.revokeObjectURL(current.previewUrl)
    const markup = { original: current.markup?.original ?? current.file, annotations }
    setChips((previous) =>
      previous.map((chip) =>
        chip.id === current.id ? { ...chip, file, previewUrl, markup } : chip,
      ),
    )
  }

  const canSubmit = value.trim().length > 0
  const editingChip = chips.find((chip) => chip.id === editingId)
  const showHint = !canSubmit && !coarse && !focused && !speech.listening && chips.length === 0
  const hasExtras = chips.length > 0 || Boolean(contextUrl) || Boolean(attachError)
  const expanded = focused || value !== '' || Boolean(interim) || hasExtras

  return (
    // Below md the bar sits in the flow and grows, pushing content down. From md the outer box
    // reserves the one-line height and the bar grows over the list below it with more elevation,
    // so typing, staging screenshots or the URL chip never shift the list.
    <div data-workspace={workspaceId} onKeyDown={onKeyDown} className="relative md:h-13.5">
      <div
        data-dragging={dragging || undefined}
        data-expanded={expanded || undefined}
        className={cn(
          't relative rounded-lg border bg-surface-2 p-2 md:absolute md:inset-x-0 md:top-0 md:z-20',
          dragging
            ? 'border-dashed border-accent shadow-elev-2'
            : expanded
              ? 'border-line-2 shadow-elev-1 md:shadow-elev-2'
              : 'border-line shadow-elev-1 hover:border-line-2',
          !dragging && 'has-[textarea:focus]:border-focus',
        )}
      >
        <div
          className={cn(
            'grid grid-cols-[auto_minmax(0,1fr)] items-end gap-1 sm:grid-cols-[auto_minmax(0,1fr)_auto]',
            // Under 360px the actions get their own full-width row so nothing overflows.
            hasExtras
              ? "[grid-template-areas:'text_text'_'extra_extra'_'tools_actions'] max-[359px]:[grid-template-areas:'text_text'_'extra_extra'_'tools_tools'_'actions_actions'] sm:[grid-template-areas:'tools_text_actions'_'._extra_extra']"
              : "[grid-template-areas:'text_text'_'tools_actions'] max-[359px]:[grid-template-areas:'text_text'_'tools_tools'_'actions_actions'] sm:[grid-template-areas:'tools_text_actions']",
          )}
        >
          <div className="relative [grid-area:text]">
            <div
              ref={mirrorRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden px-2 py-2.5 text-base leading-6 break-words whitespace-pre-wrap sm:py-1.5"
            >
              <span className="text-transparent">{value}</span>
              {interim && (
                <span data-testid="interim" className="text-ink-3">
                  {value && !/\s$/.test(value) ? ' ' : ''}
                  {interim}
                </span>
              )}
            </div>
            <textarea
              ref={setTextarea}
              value={value}
              rows={1}
              placeholder={
                interim
                  ? ''
                  : `Paste a screenshot or describe the ${kind === 'feature' ? 'feature' : 'bug'}`
              }
              aria-label={`Describe the ${noun}`}
              onChange={(e) => {
                setValue(e.target.value)
                setAttachError(null)
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="relative block min-h-11 w-full resize-none bg-transparent px-2 py-2.5 text-base leading-6 text-ink outline-none placeholder:text-ink-3 sm:min-h-9 sm:py-1.5"
            />
          </div>

          <div className="flex items-center [grid-area:tools]">
            <button
              type="button"
              aria-label="Attach image"
              title="Attach image"
              onClick={() => fileInputRef.current?.click()}
              className={ICON_BUTTON}
            >
              <Paperclip {...ICON} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              data-testid="file-input"
              onChange={onPick}
            />
            {coarse && (
              <>
                <button
                  type="button"
                  aria-label="Take photo"
                  title="Take photo"
                  onClick={() => cameraInputRef.current?.click()}
                  className={ICON_BUTTON}
                >
                  <Camera {...ICON} />
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={onPick}
                />
              </>
            )}
            {speech.supported ? (
              <button
                type="button"
                aria-label={speech.listening ? 'Stop dictation' : 'Start dictation'}
                aria-pressed={speech.listening}
                title={speech.listening ? 'Stop dictation' : 'Dictate'}
                onClick={speech.toggle}
                className={cn(
                  ICON_BUTTON,
                  speech.listening &&
                    'bg-sev-critical-tint text-danger hover:bg-sev-critical-tint hover:text-danger',
                )}
              >
                <Mic {...ICON} />
              </button>
            ) : (
              <span
                title="Voice needs Chrome, Edge, or Safari"
                className="inline-flex size-11 items-center justify-center text-ink-3 sm:size-9"
              >
                <Info
                  size={16}
                  absoluteStrokeWidth
                  strokeWidth={1.5}
                  aria-label="Voice needs Chrome, Edge, or Safari"
                />
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 [grid-area:actions] sm:h-9">
            {speech.listening && (
              <span
                role="status"
                className="flex items-center gap-1.5 font-mono text-xs text-danger"
              >
                <span
                  data-testid="recording-dot"
                  aria-hidden="true"
                  className="size-2 rounded-full bg-danger motion-safe:animate-[skeleton-pulse_1.2s_ease-in-out_infinite]"
                />
                <span className="max-sm:sr-only">Listening</span>
              </span>
            )}
            {showHint && (
              <span className="hidden items-center gap-1.5 text-xs whitespace-nowrap text-ink-3 md:inline-flex">
                Press <Kbd>N</Kbd> to focus
              </span>
            )}
            <SeverityPicker
              value={severity}
              onChange={setSeverity}
              title="Severity (Alt+1–4)"
              className="max-sm:[&>button]:h-11 pointer-coarse:[&>button]:h-11"
            />
            <button
              type="button"
              aria-label={`File ${noun}`}
              aria-busy={filing || undefined}
              aria-disabled={!canSubmit || undefined}
              title={canSubmit ? `File ${noun} (${ENTER_NAME})` : 'Type or paste to file'}
              onClick={() => void submit()}
              className={cn(
                't focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm font-medium whitespace-nowrap sm:h-9 sm:pr-1.5 pointer-coarse:h-11 pointer-coarse:pr-3.5',
                canSubmit || filing
                  ? 'border-transparent bg-accent text-accent-fg shadow-elev-1 hover:bg-accent-strong active:translate-y-px'
                  : 'cursor-default border-line bg-transparent text-ink-3',
              )}
            >
              {/* Both labels share one grid cell, so the button keeps its width while filing. */}
              <span className="grid">
                <span className={cn('[grid-area:1/1]', filing && 'invisible')}>File</span>
                <span aria-hidden="true" className={cn('[grid-area:1/1]', !filing && 'invisible')}>
                  Filing…
                </span>
              </span>
              <kbd
                aria-hidden="true"
                // The Enter hint is for keyboards: hidden on phones and coarse pointers to save room.
                className={cn(
                  'hidden h-6 min-w-6 items-center justify-center rounded-sm border px-1 font-mono text-xs leading-none sm:inline-flex pointer-coarse:hidden',
                  canSubmit || filing
                    ? 'border-accent-fg/40 text-accent-fg'
                    : 'border-line-2 text-ink-3 opacity-50',
                )}
              >
                {ENTER_GLYPH}
              </kbd>
            </button>
          </div>
          {hasExtras && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-1 pb-1 [grid-area:extra] sm:px-2">
              {chips.map((c) => (
                <AttachmentChip
                  key={c.id}
                  name={c.file.name || 'image'}
                  previewUrl={c.previewUrl}
                  onRemove={() => removeChip(c.id)}
                  onEdit={() => setEditingId(c.id)}
                />
              ))}
              {contextUrl && (
                <button
                  type="button"
                  aria-label={`Remove URL ${contextUrl}`}
                  title={contextUrl}
                  onClick={removeUrl}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      e.preventDefault()
                      removeUrl()
                    }
                  }}
                  className="t focus-ring group inline-flex h-7 max-w-full items-center gap-2 rounded-xs border border-line-2 bg-surface-1 pr-1 pl-2 font-mono text-xs text-ink-2 hover:border-line-input pointer-coarse:h-11"
                >
                  <span className="specimen-label">URL</span>
                  <span aria-hidden="true" className="h-3 w-px bg-line-2" />
                  <span className="truncate">{contextUrl}</span>
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center rounded-xs text-ink-3 group-hover:text-ink"
                  >
                    <X size={12} absoluteStrokeWidth strokeWidth={1.5} />
                  </span>
                </button>
              )}
              {attachError && (
                <div className="flex w-full items-center gap-2 text-xs text-danger">
                  <CircleAlert
                    size={14}
                    absoluteStrokeWidth
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  {/* Announced by the always-mounted live region below. */}
                  <p aria-hidden="true" className="min-w-0 flex-1">
                    {attachError}
                  </p>
                  <button
                    type="button"
                    aria-label="Dismiss error"
                    onClick={() => setAttachError(null)}
                    className="t focus-ring -my-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:size-11"
                  >
                    <X size={14} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mounted empty from the start so screen readers announce the first error too. */}
        <p role="status" aria-live="polite" className="sr-only">
          {attachError ?? ''}
        </p>

        {dragging && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-accent-tint text-sm font-medium text-accent"
          >
            <ImagePlus {...ICON} />
            Drop screenshots to attach
          </div>
        )}
      </div>

      {editingChip && (
        <AnnotateDialog
          key={editingChip.id}
          file={editingChip.markup?.original ?? editingChip.file}
          initialShapes={editingChip.markup?.annotations.shapes}
          onClose={() => setEditingId(null)}
          onSave={saveMarkedUp}
        />
      )}
    </div>
  )
}
