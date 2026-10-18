import { useCallback, useEffect, useRef, useState } from 'react'
import { forgetBridgeQuestion, getBridgeQuestions, type ClaudeQuestion } from '../lib/claudeExport'

/** How often to check for answers while Claude is working on one, and otherwise. */
const POLL_ACTIVE_MS = 2000
const POLL_IDLE_MS = 20_000

export interface UseClaudeQuestionsResult {
  /** Questions asked in this workspace on this computer, newest first. */
  questions: ClaudeQuestion[]
  /** Loads the list now (after asking, so the new question shows straight away). */
  refresh(): void
  /** Removes a question and its answer. */
  forget(id: string): Promise<void>
}

/**
 * Follows the questions asked about the project through the Claude Code helper. `enabled` is
 * false while the helper is missing or too old to answer questions. `onAnswered` fires once for
 * each question that gets its answer while this tab is watching.
 */
export function useClaudeQuestions(
  workspaceId: string,
  enabled: boolean,
  onAnswered?: (question: ClaudeQuestion) => void,
): UseClaudeQuestionsResult {
  const [questions, setQuestions] = useState<ClaudeQuestion[]>([])
  const [nonce, setNonce] = useState(0)
  const working = useRef<Set<string>>(new Set())
  const answered = useRef(onAnswered)
  useEffect(() => {
    answered.current = onAnswered
  }, [onAnswered])
  const anyWorking = enabled && questions.some((q) => q.state === 'working')

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = () =>
      void getBridgeQuestions(workspaceId).then(
        (list) => {
          if (!active) return
          for (const q of list) {
            if (q.state === 'answered' && working.current.has(q.id)) answered.current?.(q)
          }
          working.current = new Set(list.filter((q) => q.state === 'working').map((q) => q.id))
          setQuestions(list)
        },
        () => {},
      )
    load()
    const timer = setInterval(load, anyWorking ? POLL_ACTIVE_MS : POLL_IDLE_MS)
    window.addEventListener('focus', load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [enabled, workspaceId, anyWorking, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const forget = useCallback(
    async (id: string) => {
      await forgetBridgeQuestion(workspaceId, id)
      setQuestions((list) => list.filter((q) => q.id !== id))
    },
    [workspaceId],
  )

  return { questions: enabled ? questions : [], refresh, forget }
}
