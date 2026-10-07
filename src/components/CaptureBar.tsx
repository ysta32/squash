import { collectEnvContext, extractUrl, sanitizeContext } from '../lib/bugContext'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { Camera, CornerDownLeft, Info, Mic, Paperclip, SendHorizontal } from 'lucide-react'
import type { NewBugInput } from '../hooks/useBugs'
import { useSpeech } from '../hooks/useSpeech'
import { usePasteImage } from '../hooks/usePasteImage'
import { isOverlayOpen, isTypingTarget } from '../hooks/useKeyboard'
import { MAX_ORIGINAL_BYTES } from '../hooks/useImageCompression'
import { fitUnder } from '../lib/annotate'
import { SEVERITIES } from '../lib/types'
import type { BugKind, Severity } from '../lib/types'
import { cn, randomId } from '../lib/utils'
import { AttachmentChip } from './AttachmentChip'
import { AnnotateDialog } from './AnnotateDialog'
import { SeverityPicker } from './SeverityPicker'
import { Kbd } from './ui'

const MAX_FILES = 10
const MAX_TEXTAREA_PX = 6 * 24

const ICON_BUTTON =
  't focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg'

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
  file: File
  previewUrl: string
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
      if (tooLarge) onToast?.('Image too large (max 5MB)')
      if (tooMany) onToast?.(`Max ${MAX_FILES} images per bug`)
      if (accepted.length > 0) setChips((prev) => [...prev, ...accepted])
    },
    [onToast],
  )

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
    try {
      await onSubmit({
        description,
        context,
        transcript: snapshot.transcript,
        severity: snapshot.severity,
        kind,
        files,
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

  const saveMarkedUp = async (file: File): Promise<void> => {
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
    setChips((previous) =>
      previous.map((chip) => (chip.id === current.id ? { ...chip, file, previewUrl } : chip)),
    )
  }

  const canSubmit = value.trim().length > 0
  const editingChip = chips.find((chip) => chip.id === editingId)

  return (
    <div
      data-workspace={workspaceId}
      onKeyDown={onKeyDown}
      className="t rounded-lg border border-border bg-bg p-2 shadow-sm hover:border-fg/20 focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent/15 focus-within:hover:border-accent/60"
    >
      <div className="relative">
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1.5 py-1 text-sm leading-6"
        >
          <span className="text-transparent">{value}</span>
          {interim && (
            <span data-testid="interim" className="text-muted">
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
              : kind === 'feature'
                ? 'Paste a screenshot or describe a feature'
                : 'Paste a screenshot or describe a bug'
          }
          aria-label={`Describe the ${noun}`}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative block w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-6 text-fg outline-none placeholder:text-muted"
        />
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 px-1.5">
          {chips.map((c) => (
            <AttachmentChip
              key={c.id}
              name={c.file.name || 'image'}
              previewUrl={c.previewUrl}
              onRemove={() => removeChip(c.id)}
              onEdit={() => setEditingId(c.id)}
            />
          ))}
        </div>
      )}

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
          className="focus-ring mt-1 inline-flex max-w-full items-center gap-1 rounded border border-border px-2 py-1 font-mono text-xs text-muted"
        >
          <span className="truncate">URL {contextUrl}</span>
          <span aria-hidden="true">×</span>
        </button>
      )}
      {editingChip && (
        <AnnotateDialog
          key={editingChip.id}
          file={editingChip.file}
          onClose={() => setEditingId(null)}
          onSave={saveMarkedUp}
        />
      )}

      <div className="mt-1.5 flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Attach image"
          title="Attach image"
          onClick={() => fileInputRef.current?.click()}
          className={ICON_BUTTON}
        >
          <Paperclip size={16} aria-hidden="true" />
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
              <Camera size={16} aria-hidden="true" />
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
          <span className="flex items-center">
            <button
              type="button"
              aria-label={speech.listening ? 'Stop dictation' : 'Start dictation'}
              aria-pressed={speech.listening}
              title={speech.listening ? 'Stop dictation' : 'Dictate'}
              onClick={speech.toggle}
              className={cn(
                ICON_BUTTON,
                speech.listening && 'bg-danger/10 text-danger hover:bg-danger/15 hover:text-danger',
              )}
            >
              <Mic size={16} aria-hidden="true" />
            </button>
            {speech.listening && (
              <span
                data-testid="recording-dot"
                className="ml-1 h-2 w-2 animate-pulse rounded-full bg-danger"
              />
            )}
          </span>
        ) : (
          <span
            title="Voice needs Chrome, Edge, or Safari"
            className="inline-flex h-8 w-8 items-center justify-center text-muted/70"
          >
            <Info size={16} aria-label="Voice needs Chrome, Edge, or Safari" />
          </span>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {!canSubmit && !coarse && !focused && (
            <span className="hidden items-center gap-1 text-xs text-muted md:inline-flex">
              Press <Kbd>N</Kbd> to focus
            </span>
          )}
          <SeverityPicker value={severity} onChange={setSeverity} title="Severity (Alt+1–4)" />
          <button
            type="button"
            aria-label={`File ${noun}`}
            title={`File ${noun} (Enter)`}
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="t focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent text-xs font-medium whitespace-nowrap text-accent-fg shadow-sm hover:opacity-90 disabled:pointer-events-none disabled:bg-bg-subtle disabled:text-muted disabled:shadow-none sm:w-auto sm:pr-1.5 sm:pl-2.5"
          >
            <SendHorizontal size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{kind === 'feature' ? 'Request' : 'File bug'}</span>
            <kbd
              aria-hidden="true"
              className="hidden h-5 min-w-5 items-center justify-center rounded bg-current/15 px-1 font-sans text-[11px] sm:inline-flex"
            >
              <CornerDownLeft size={11} />
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
