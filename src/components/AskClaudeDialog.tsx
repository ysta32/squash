import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, MessageCircleQuestionMark, Paperclip, Trash2, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  ASK_MAX_FILES,
  ASK_MAX_FILE_BYTES,
  ASK_MAX_QUESTION,
  ASK_VERSION,
  BridgeError,
  installCommand,
  type BridgeStatus,
  type ClaudeQuestion,
} from '../lib/claudeExport'
import { Markdown } from '../lib/markdown'
import { KIND_LABEL } from '../lib/types'
import type { BugWithMeta } from '../lib/types'
import { cn, relativeTime } from '../lib/utils'
import { StatusGlyph } from './ClaudeProgress'
import { DialogHeader } from './DialogHeader'
import { Button, Field } from './ui'
import { inputClass } from './ui/styles'
import {
  dialogActionsClass,
  dialogClass,
  dialogMaxHeightClass,
  dialogPositionClass,
  scrimClass,
} from './dialogStyles'

/** Full-width 44px buttons on phones; regular height from 480px unless the pointer is coarse. */
const TOUCH = 'max-[479px]:h-11 max-[479px]:w-full pointer-coarse:h-[3.1429rem]'
const chipClass =
  'inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-line-2 bg-surface-3 pr-0.5 pl-2 text-xs text-ink'
const chipRemoveClass =
  't focus-ring flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-1 hover:text-ink'
/** Items suggested at once while searching for one to add. */
const MAX_MATCHES = 6

export interface AskClaudeDialogProps {
  open: boolean
  onClose: () => void
  /** Every item in the workspace, to pick the ones the question is about. */
  bugs: BugWithMeta[]
  /** Items picked when the dialog opened (the list's selection). */
  initial: BugWithMeta[]
  status: BridgeStatus | null
  questions: ClaudeQuestion[]
  onAsk(question: string, items: BugWithMeta[], files: File[]): Promise<void>
  onForget(id: string): Promise<void>
  /** Opens an item by number. */
  onOpenNumber(number: number): void
  /** Opens the Claude Code setup guide. */
  onSetup(): void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * "Ask Claude": a question about the project ("Is #12 fixed yet?"), optionally about some items and
 * with files attached. Claude Code answers it read-only in the background, with no terminal, and
 * the answer shows here.
 */
export function AskClaudeDialog({
  open,
  onClose,
  bugs,
  initial,
  status,
  questions,
  onAsk,
  onForget,
  onOpenNumber,
  onSetup,
}: AskClaudeDialogProps) {
  const [question, setQuestion] = useState('')
  const [items, setItems] = useState<BugWithMeta[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useFocusTrap(dialogRef, open, { initialFocus: 'field' })

  // Each opening starts from the list's current selection.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setItems(initial.filter((b) => !b.optimistic))
      setError(null)
      setSearch('')
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '')
    if (!q) return []
    const picked = new Set(items.map((b) => b.id))
    return bugs
      .filter(
        (b) =>
          !b.optimistic &&
          !picked.has(b.id) &&
          (String(b.number).startsWith(q) || b.title.toLowerCase().includes(q)),
      )
      .slice(0, MAX_MATCHES)
  }, [bugs, items, search])

  if (!open) return null

  const ready = status !== null && status.version >= ASK_VERSION
  const byNumber = new Map(bugs.map((b) => [b.number, b]))

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const added = Array.from(list)
    const tooBig = added.find((f) => f.size > ASK_MAX_FILE_BYTES)
    if (tooBig) {
      setError(`${tooBig.name} is over ${ASK_MAX_FILE_BYTES / 1024 / 1024} MB.`)
      return
    }
    const next = [...files, ...added]
    if (next.length > ASK_MAX_FILES) {
      setError(`Attach at most ${ASK_MAX_FILES} files.`)
      return
    }
    setError(null)
    setFiles(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !question.trim() || !ready) return
    setBusy(true)
    setError(null)
    try {
      await onAsk(question, items, files)
      setQuestion('')
      setFiles([])
    } catch (err) {
      setError(
        err instanceof BridgeError && err.code === 'cancelled'
          ? 'No project folder chosen, so nothing was asked.'
          : err instanceof TypeError
            ? 'The Claude Code helper is not responding.'
            : err instanceof Error
              ? err.message
              : 'Could not ask Claude.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn(scrimClass, dialogPositionClass)} onClick={onClose}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Claude about the project"
        onSubmit={(e) => void submit(e)}
        className={cn(dialogClass, dialogMaxHeightClass, 'max-w-150 overflow-y-auto p-6')}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          eyebrow="Claude Code · question"
          title="Ask about the project"
          onClose={onClose}
        >
          <p className="mt-1 text-sm text-ink-2">
            Claude reads the code and its history, changes nothing, and answers here. No terminal
            opens.
          </p>
        </DialogHeader>

        {!ready && (
          <div
            role="status"
            className="mt-4 rounded-md border border-line-2 bg-surface-3 p-3 text-sm"
          >
            <p className="text-ink">
              {status
                ? 'Update the Claude Code helper to ask questions here.'
                : 'Start the Claude Code helper to ask questions here.'}
            </p>
            <p className="mt-1 text-ink-2">
              Run{' '}
              <code className="font-mono text-xs [overflow-wrap:anywhere] text-ink">
                {installCommand(window.location.origin)}
              </code>{' '}
              in a terminal, or open{' '}
              <button
                type="button"
                onClick={onSetup}
                className="focus-ring rounded-xs font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              >
                Claude setup
              </button>
              .
            </p>
          </div>
        )}

        <Field label="Question" className="mt-5">
          {({ id }) => (
            <textarea
              id={id}
              required
              rows={3}
              maxLength={ASK_MAX_QUESTION}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Has #12 been fixed and deployed yet?"
              className={cn(inputClass, 'h-auto min-h-20 resize-y py-2 pointer-coarse:h-auto')}
            />
          )}
        </Field>

        <Field
          label="About these items"
          className="mt-4"
          hint="Optional. Search by number or title to add one."
        >
          {({ id, describedBy }) => (
            <div>
              {items.length > 0 && (
                <ul aria-label="Items in the question" className="mb-2 flex flex-wrap gap-1.5">
                  {items.map((b) => (
                    <li key={b.id} className={chipClass}>
                      <span className="font-mono tabular-nums text-ink-3">#{b.number}</span>
                      <span className="min-w-0 truncate">{b.title}</span>
                      <button
                        type="button"
                        aria-label={`Remove #${b.number}`}
                        onClick={() => setItems(items.filter((i) => i.id !== b.id))}
                        className={chipRemoveClass}
                      >
                        <X size={12} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                id={id}
                aria-describedby={describedBy}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (matches[0]) {
                      setItems([...items, matches[0]])
                      setSearch('')
                    }
                  }
                }}
                placeholder="#12 or a title"
                autoComplete="off"
                className={inputClass}
              />
              {matches.length > 0 && (
                <ul
                  aria-label="Matching items"
                  className="mt-1 rounded-md border border-line-2 bg-surface-1 p-1"
                >
                  {matches.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setItems([...items, b])
                          setSearch('')
                        }}
                        className="t focus-ring-inset flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm text-ink hover:bg-surface-3 pointer-coarse:h-11"
                      >
                        <span className="font-mono text-xs tabular-nums text-ink-3">
                          #{b.number}
                        </span>
                        <span className="min-w-0 truncate">{b.title}</span>
                        <span className="ml-auto shrink-0 text-xs text-ink-3">
                          {KIND_LABEL[b.kind].one}
                          {b.status === 'resolved' ? ' · resolved' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>

        <div className="mt-4">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          {files.length > 0 && (
            <ul aria-label="Attached files" className="mb-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className={chipClass}>
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="shrink-0 text-ink-3">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className={chipRemoveClass}
                  >
                    <X size={12} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={files.length >= ASK_MAX_FILES}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={14} strokeWidth={1.5} aria-hidden="true" />
            Attach files
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <div
          className={cn(
            dialogActionsClass,
            'max-[479px]:flex-col-reverse max-[479px]:items-stretch',
          )}
        >
          <Button type="button" onClick={onClose} className={TOUCH}>
            Close
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !question.trim() || !ready}
            className={TOUCH}
          >
            <MessageCircleQuestionMark
              size={16}
              absoluteStrokeWidth
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {busy ? 'Asking…' : 'Ask Claude'}
          </Button>
        </div>

        {questions.length > 0 && (
          <section aria-label="Answers" className="mt-6 border-t border-line pt-4">
            <h3 className="specimen-label">Answers</h3>
            <ol className="mt-2 space-y-3">
              {questions.map((q) => (
                <li key={q.id} className="rounded-md border border-line-2 bg-surface-1 p-3">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                      {q.question}
                    </p>
                    <button
                      type="button"
                      aria-label="Remove this question"
                      title="Remove"
                      onClick={() => void onForget(q.id).catch(() => {})}
                      className="t focus-ring -mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                    >
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    <span>{relativeTime(q.askedAt)}</span>
                    {q.bugs.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          onOpenNumber(n)
                          onClose()
                        }}
                        title={byNumber.get(n)?.title}
                        className="focus-ring rounded-xs font-mono tabular-nums text-accent hover:underline"
                      >
                        #{n}
                      </button>
                    ))}
                    {q.files.length > 0 && (
                      <span>
                        {q.files.length} {q.files.length === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </p>
                  <div className="mt-2" aria-live="polite">
                    {q.state === 'working' ? (
                      <p className="flex items-center gap-1.5 text-sm text-ink-2">
                        <StatusGlyph kind="working" className="size-3.5 text-status-progress" />
                        <span className="min-w-0 truncate">{q.activity ?? 'Thinking'}…</span>
                      </p>
                    ) : q.state === 'answered' && q.answer ? (
                      <Markdown source={q.answer} className="text-ink" />
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm text-danger">
                        <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
                        {q.error ?? 'No answer.'}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </form>
    </div>
  )
}
