import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { Camera, Info, Mic, Paperclip, Send } from 'lucide-react'
import type { NewBugInput } from '../hooks/useBugs'
import { useSpeech } from '../hooks/useSpeech'
import { usePasteImage } from '../hooks/usePasteImage'
import { MAX_ORIGINAL_BYTES } from '../hooks/useImageCompression'
import { SEVERITIES } from '../lib/types'
import type { Severity } from '../lib/types'
import { cn, randomId } from '../lib/utils'
import { AttachmentChip } from './AttachmentChip'
import { SeverityPicker } from './SeverityPicker'

const MAX_FILES = 10
const MAX_TEXTAREA_PX = 6 * 24

interface CaptureBarProps {
  workspaceId: string
  onSubmit: (input: NewBugInput) => Promise<void>
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

export function CaptureBar({ workspaceId, onSubmit, onToast, focusRef }: CaptureBarProps) {
  const [value, setValueState] = useState('')
  const [interim, setInterim] = useState('')
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
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const chipsRef = useRef<Chip[]>(chips)
  const [coarse] = useState(isCoarsePointer)

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
    },
    [],
  )

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

  usePasteImage(addFiles)

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
    }
    const files = snapshot.chips.map((c) => c.file)
    setValue('')
    setTranscript(null)
    setSeverity('medium')
    setChips([])
    try {
      await onSubmit({
        description,
        transcript: snapshot.transcript,
        severity: snapshot.severity,
        files,
      })
      snapshot.chips.forEach((c) => URL.revokeObjectURL(c.previewUrl))
    } catch (err) {
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
      onToast?.(err instanceof Error ? err.message : 'Could not file bug')
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

  const canSubmit = value.trim().length > 0

  return (
    <div
      data-workspace={workspaceId}
      onKeyDown={onKeyDown}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 shadow-sm focus-within:border-[var(--accent)]"
    >
      <div className="relative">
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1 py-1 text-sm leading-6"
        >
          <span className="text-transparent">{value}</span>
          {interim && (
            <span data-testid="interim" className="text-[var(--muted)]">
              {value && !/\s$/.test(value) ? ' ' : ''}
              {interim}
            </span>
          )}
        </div>
        <textarea
          ref={setTextarea}
          value={value}
          rows={1}
          placeholder={interim ? '' : 'Describe the bug…'}
          onChange={(e) => setValue(e.target.value)}
          className="relative block w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
        />
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <AttachmentChip
              key={c.id}
              name={c.file.name || 'image'}
              previewUrl={c.previewUrl}
              onRemove={() => removeChip(c.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          aria-label="Attach image"
          title="Attach image"
          onClick={() => fileInputRef.current?.click()}
          className="rounded p-1.5 text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <Paperclip size={16} />
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
              className="rounded p-1.5 text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <Camera size={16} />
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
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label={speech.listening ? 'Stop dictation' : 'Start dictation'}
              aria-pressed={speech.listening}
              title="Dictate"
              onClick={speech.toggle}
              className={cn(
                'rounded p-1.5 hover:text-[var(--fg)]',
                speech.listening ? 'text-red-500' : 'text-[var(--muted)]',
              )}
            >
              <Mic size={16} />
            </button>
            {speech.listening && (
              <span
                data-testid="recording-dot"
                className="h-2 w-2 animate-pulse rounded-full bg-red-500"
              />
            )}
          </span>
        ) : (
          <span title="Voice needs Chrome, Edge, or Safari" className="p-1.5 text-[var(--muted)]">
            <Info size={16} aria-label="Voice needs Chrome, Edge, or Safari" />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SeverityPicker value={severity} onChange={setSeverity} />
          <button
            type="button"
            aria-label="File bug"
            title="File bug (Enter)"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded bg-[var(--accent)] p-1.5 text-white disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
