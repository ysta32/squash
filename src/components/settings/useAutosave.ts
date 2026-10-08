import { useCallback, useEffect, useRef, useState } from 'react'
import { sessionEpoch } from '../../lib/sessionEpoch'

/** How long the inline "Saved" tick stays before the row goes quiet again. */
export const SAVED_MS = 2500

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

/**
 * One field's save line, kept at module level and keyed by entity and field
 * ("profile:<id>:name"), not in the component: Settings unmounts a panel on every tab change, and
 * a save queued before the switch must still finish before one made after coming back, or the
 * older value could land last. Once a line has drained it is only trusted while the rendered
 * server value is still the one it started from; when that changes (our write came back, or a
 * teammate edited the field) the server value wins again.
 */
interface SaveLine {
  /** The session epoch the line belongs to; lines from an earlier session are dropped. */
  epoch: number
  /** Sequence number of the newest queued save (identity, not value: A → B → A is two saves). */
  seq: number
  /** The server value when the line started. */
  server: unknown
  /** True when every queued save has finished. */
  idle: boolean
  /** Resolves when every queued save has finished (never rejects). */
  tail: Promise<void>
  /** The value of the newest queued save. */
  queued: unknown
  /** The last value this line wrote successfully, if any. */
  written: { value: unknown } | null
}
const lines = new Map<string, SaveLine>()
/** Drained lines kept at most; the oldest idle ones are evicted first (Map keeps insertion order). */
const MAX_LINES = 64
let nextSeq = 0

function evictIdle() {
  if (lines.size <= MAX_LINES) return
  for (const [key, line] of lines) {
    if (lines.size <= MAX_LINES) break
    if (line.idle) lines.delete(key)
  }
}

export interface CommitOptions {
  /** Runs when this save fails and it was still the newest one queued for the field. */
  onFail?: (rollbackTo: unknown) => void
}

/**
 * Autosave for one settings field. `commit(value, write)` queues `write(value)` behind any save of
 * the same field still in flight (even from an earlier mount), skips a value that is already
 * queued or written, and reports the newest save's outcome as `state`: "Saving…", a brief
 * "Saved" tick, or an error.
 *
 * `server` is the field's value as rendered from the database; it is the baseline whenever no
 * save is queued.
 */
function lineFor(key: string, server: unknown): SaveLine | undefined {
  const line = lines.get(key)
  if (line && line.epoch !== sessionEpoch()) {
    lines.delete(key)
    return undefined
  }
  if (line && line.idle && !Object.is(line.server, server)) {
    lines.delete(key)
    return undefined
  }
  return line
}

export function useAutosave<T>(key: string, server: T, fallbackError: string) {
  const latest = useRef(0)
  const mounted = useRef(true)
  const [saveState, setState] = useState<SaveState>({ status: 'idle' })
  // A validation message for the draft; kept apart so a save in flight still reports its result.
  const [invalid, setInvalid] = useState<string | null>(null)
  const state: SaveState = invalid ? { status: 'error', message: invalid } : saveState

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (saveState.status !== 'saved') return
    const timer = window.setTimeout(() => setState({ status: 'idle' }), SAVED_MS)
    return () => window.clearTimeout(timer)
  }, [saveState])

  /** The value the field will hold once queued saves finish (the baseline for "changed?"). */
  const pending = useCallback((): T => {
    const line = lineFor(key, server)
    return line ? (line.queued as T) : server
  }, [key, server])

  const commit = useCallback(
    (value: T, write: (value: T) => Promise<void>, options: CommitOptions = {}) => {
      setInvalid(null)
      const line = lineFor(key, server)
      if (Object.is(value, line ? line.queued : server)) return Promise.resolve()
      const current: SaveLine = line ?? {
        epoch: sessionEpoch(),
        seq: 0,
        server,
        idle: true,
        tail: Promise.resolve(),
        queued: server,
        written: null,
      }
      const baseline = current.server
      const seq = ++nextSeq
      current.seq = seq
      current.queued = value
      current.idle = false
      lines.set(key, current)
      evictIdle()

      const id = ++latest.current
      setState({ status: 'saving' })
      const step = async () => {
        // Queued under a session that has since ended (sign-out, account switch): never run it.
        if (current.epoch !== sessionEpoch()) return false
        const before = current.written ? current.written.value : baseline
        if (Object.is(value, before)) return false
        try {
          await write(value)
        } catch (cause) {
          const newest = current.seq === seq
          // Let the same value be retried, and roll the field back to what the server has.
          if (newest) current.queued = before
          if (newest && mounted.current) options.onFail?.(before)
          throw cause
        }
        current.written = { value }
        return true
      }
      const next = current.tail.then(step).then(
        (changed) => {
          if (mounted.current && id === latest.current)
            setState({ status: changed ? 'saved' : 'idle' })
        },
        (cause: unknown) => {
          if (mounted.current && id === latest.current)
            setState({
              status: 'error',
              message: cause instanceof Error ? cause.message : fallbackError,
            })
        },
      )
      current.tail = next
      void next.then(() => {
        if (current.tail === next) {
          current.idle = true
          evictIdle()
        }
      })
      return next
    },
    [key, server, fallbackError],
  )

  /** Shows a validation error for the draft without saving. */
  const fail = useCallback((message: string) => setInvalid(message), [])

  /**
   * Clears errors after the draft is reverted. A save still in flight keeps reporting its own
   * outcome (its failure still shows), since that value may not have reached the server.
   */
  const clearError = useCallback(() => {
    setInvalid(null)
    setState((previous) => (previous.status === 'error' ? { status: 'idle' } : previous))
  }, [])

  return { state, commit, pending, fail, clearError }
}

/** Test helper: forget every queued save line. */
export function resetAutosaveLines() {
  lines.clear()
}
