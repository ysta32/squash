import { collectEnvContext, extractUrl, findUrl, sanitizeContext } from '../lib/bugContext'
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
import { useCoarsePointer, useMediaQuery } from '../hooks/useCoarsePointer'
import { AttachmentChip } from './AttachmentChip'
import { AnnotateDialog } from './AnnotateDialog'
import { SeverityPicker } from './SeverityPicker'
import { ENTER_KEY, Kbd } from './ui'

const MAX_FILES = 10
/** Eight 24px lines; past that the textarea scrolls. */
const MAX_TEXTAREA_PX = 8 * 24
/** Phones from 360px up to Tailwind's `sm`: room for a one-row bar at rest. */
const PHONE_ROW_QUERY = '(min-width: 360px) and (max-width: 639.98px)'

/** 44px touch targets on phones, 36px from `sm` up (44px again on coarse pointers). */
const ICON_BUTTON =
  't focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink sm:size-9 pointer-coarse:size-[3.1429rem]'
const ICON = { size: 16, absoluteStrokeWidth: true, strokeWidth: 1.5, 'aria-hidden': true } as const

const ENTER_NAME = isMac ? 'Return' : 'Enter'

const TOO_LARGE = 'Screenshot not added: the file is over 5 MB. Try a smaller crop.'
const TOO_MANY = `Up to ${MAX_FILES} screenshots per bug. The rest weren’t added.`

/** `text` without the URL at `at`, tidying the spaces around it; `cut` is where it was. */
function withoutUrl(text: string, at: number, length: number): { text: string; cut: number } {
  const before = text.slice(0, at).replace(/[ \t]+$/, '')
  const rawAfter = text.slice(at + length)
  const after = rawAfter.replace(/^[ \t]+/, '')
  const joinWords =
    before !== '' && !before.endsWith('\n') && after !== '' && !/^[\n.,;:!?)\]}]/.test(after)
  // A space typed right after a trailing URL stays, so the next word does not glue on.
  const keepTrailingSpace = before !== '' && after === '' && rawAfter !== ''
  const joiner = joinWords || keepTrailingSpace ? ' ' : ''
  return { text: before + joiner + after, cut: before.length + joiner.length }
}

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
  const removedUrlsRef = useRef<string[]>([])
  // The page URL lifted out of the text into a chip (so it is not shown twice).
  const [contextUrl, setContextUrlState] = useState<string | undefined>(undefined)
  const contextUrlRef = useRef<string | undefined>(undefined)
  // The URL exactly as typed, put back into the text if the chip is removed.
  const contextRawRef = useRef<string | undefined>(undefined)
  const setContextUrl = (u: string | undefined) => {
    contextUrlRef.current = u
    setContextUrlState(u)
  }
  // Caret to restore after the text is rewritten (React would otherwise park it at the end).
  const pendingCaret = useRef<number | null>(null)

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
  const coarse = useCoarsePointer()
  const phoneRow = useMediaQuery(PHONE_ROW_QUERY)
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
    const caret = pendingCaret.current
    if (caret !== null) {
      pendingCaret.current = null
      if (document.activeElement === el) el.setSelectionRange(caret, caret)
    }
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

  /** Takes a typed or pasted URL out of the text and into the URL chip once it is complete. */
  const changeText = (next: string, caret: number | null) => {
    const previous = valueRef.current
    setAttachError(null)
    const found = contextUrlRef.current ? undefined : findUrl(next)
    if (!found || removedUrlsRef.current.includes(found.url)) {
      setValue(next)
      return
    }
    const at = found.index
    // While typing, "https://e" already parses: wait for the URL to end (whitespace after it).
    // Pasted or replaced text arrives whole, so it is complete at once.
    const bulk = next.length - previous.length > 1
    const end = at + found.length
    const typedEnd =
      caret !== null &&
      caret > end &&
      /\s/.test(next[caret - 1] ?? '') &&
      /^[.,;:!?)\]}]*$/.test(next.slice(end, caret - 1))
    if (!bulk && !typedEnd) {
      setValue(next)
      return
    }
    const stripped = withoutUrl(next, at, found.length)
    contextRawRef.current = next.slice(at, end)
    setContextUrl(found.url)
    setValue(stripped.text)
    if (caret !== null) {
      pendingCaret.current =
        caret <= at ? caret : Math.max(stripped.cut, caret - (next.length - stripped.text.length))
    }
  }

  // × keeps the URL as plain text (it is just not attached as context) and stops re-detecting it.
  const removeUrl = () => {
    const url = contextUrlRef.current
    if (!url) return
    const raw = contextRawRef.current ?? url
    removedUrlsRef.current = [...removedUrlsRef.current, url]
    setContextUrl(undefined)
    const v = valueRef.current
    setValue(v.trim() === '' ? raw : `${v.trimEnd()} ${raw}`)
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
    const chippedUrl = contextUrlRef.current
    // A URL on its own is a valid report: it becomes the description as well as the context.
    const description = valueRef.current.trim() || chippedUrl || ''
    if (!description) return
    const snapshot = {
      value: valueRef.current,
      url: chippedUrl,
      rawUrl: contextRawRef.current ?? chippedUrl,
      transcript: transcriptRef.current,
      severity: severityRef.current,
      chips: chipsRef.current,
      removedUrls: removedUrlsRef.current,
    }
    // A URL still being typed when Enter is pressed stays in the text and is attached as well.
    const typedUrl = extractUrl(description)
    const context = sanitizeContext({
      ...collectEnvContext(),
      url:
        chippedUrl ?? (typedUrl && !snapshot.removedUrls.includes(typedUrl) ? typedUrl : undefined),
    })
    removedUrlsRef.current = []
    setContextUrl(undefined)
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
      let restored = snapshot.value
      if (snapshot.url && !contextUrlRef.current) {
        contextRawRef.current = snapshot.rawUrl
        setContextUrl(snapshot.url)
      } else if (snapshot.url && snapshot.rawUrl && snapshot.url !== contextUrlRef.current) {
        // A newer draft already has its own URL chip: keep the failed one as text.
        restored =
          restored.trim() === '' ? snapshot.rawUrl : `${restored.trimEnd()} ${snapshot.rawUrl}`
      }
      const current = valueRef.current
      setValue(current.trim() === '' ? restored : `${restored.trimEnd()}\n\n${current}`)
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

  const canSubmit = value.trim().length > 0 || Boolean(contextUrl)
  const editingChip = chips.find((chip) => chip.id === editingId)
  const showHint = !canSubmit && !coarse && !focused && !speech.listening && chips.length === 0
  const hasExtras = chips.length > 0 || Boolean(contextUrl) || Boolean(attachError)
  const expanded = focused || value !== '' || Boolean(interim) || hasExtras
  // On a phone at rest the bar is one row (attach · text · severity · File), not two 44px rows;
  // it opens to the full layout with camera and dictation as soon as it is used.
  const oneRow = phoneRow && !expanded && !speech.listening

  return (
    // At every width the bar sits in the flow and grows, pushing the list toolbar down rather than
    // covering it. Its growth is bounded: the text scrolls past eight lines and the attachment
    // row scrolls inside the bar past two rows of thumbnails.
    <div data-workspace={workspaceId} onKeyDown={onKeyDown} className="relative">
      <div
        data-dragging={dragging || undefined}
        data-expanded={expanded || undefined}
        className={cn(
          't relative rounded-lg border bg-surface-2 p-2',
          dragging
            ? 'border-dashed border-accent shadow-elev-2'
            : expanded
              ? 'border-line-2 shadow-elev-1'
              : 'border-line shadow-elev-1 hover:border-line-2',
          !dragging && 'has-[textarea:focus]:border-focus',
        )}
      >
        <div
          className={cn(
            'grid items-end gap-1 sm:grid-cols-[auto_minmax(0,1fr)_auto]',
            // Under 360px the actions get their own full-width row so nothing overflows.
            oneRow
              ? "grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'tools_text_actions']"
              : 'grid-cols-[auto_minmax(0,1fr)]',
            !oneRow &&
              (hasExtras
                ? "[grid-template-areas:'text_text'_'extra_extra'_'tools_actions'] max-[359px]:[grid-template-areas:'text_text'_'extra_extra'_'tools_tools'_'actions_actions'] sm:[grid-template-areas:'tools_text_actions'_'._extra_extra']"
                : "[grid-template-areas:'text_text'_'tools_actions'] max-[359px]:[grid-template-areas:'text_text'_'tools_tools'_'actions_actions'] sm:[grid-template-areas:'tools_text_actions']"),
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
                  : oneRow
                    ? `Describe the ${kind === 'feature' ? 'feature' : 'bug'}`
                    : `Paste a screenshot or describe the ${kind === 'feature' ? 'feature' : 'bug'}`
              }
              aria-label={`Describe the ${noun}`}
              onChange={(e) => changeText(e.target.value, e.target.selectionStart)}
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
            {coarse && !oneRow && (
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
            {oneRow ? null : speech.supported ? (
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
              compact
              className="sm:[&>button]:h-9 sm:pointer-coarse:[&>button]:h-11"
            />
            <button
              type="button"
              aria-label={`File ${noun}`}
              aria-busy={filing || undefined}
              aria-disabled={!canSubmit || undefined}
              title={canSubmit ? `File ${noun} (${ENTER_NAME})` : 'Type or paste to file'}
              onClick={() => void submit()}
              className={cn(
                't focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm font-medium whitespace-nowrap sm:h-9 sm:pr-1.5 pointer-coarse:h-[3.1429rem] pointer-coarse:pr-3.5',
                canSubmit || filing
                  ? 'border-transparent bg-accent text-accent-fg shadow-elev-1 hover:bg-accent-strong active:translate-y-px'
                  : // Disabled reads as the same control at half strength, border and key cap kept.
                    'cursor-default border-line-input bg-transparent text-ink opacity-50',
              )}
            >
              {/* Both labels share one grid cell, so the button keeps its width while filing. */}
              <span className="grid">
                <span className={cn('[grid-area:1/1]', filing && 'invisible')}>File</span>
                <span aria-hidden="true" className={cn('[grid-area:1/1]', !filing && 'invisible')}>
                  Filing…
                </span>
              </span>
              {/* The Enter hint is for keyboards: hidden on phones and coarse pointers to save room. */}
              <span aria-hidden="true" className="hidden sm:inline-flex pointer-coarse:hidden">
                <Kbd tone={canSubmit || filing ? 'accent' : 'default'}>{ENTER_KEY}</Kbd>
              </span>
            </button>
          </div>
          {hasExtras && (
            // Two rows of thumbnails at most; past that the row scrolls inside the bar.
            <div className="flex max-h-[176px] flex-wrap items-center gap-2 overflow-y-auto overscroll-contain p-1 [grid-area:extra] sm:px-2">
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
                  className="t focus-ring group inline-flex h-7 max-w-full items-center gap-2 rounded-xs border border-line-2 bg-surface-1 pr-1 pl-2 font-mono text-xs text-ink-2 hover:border-line-input pointer-coarse:h-[3.1429rem]"
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
                    className="t focus-ring -my-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:size-[3.1429rem]"
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
