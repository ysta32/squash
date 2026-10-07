import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useBug } from '../hooks/useBug'
import type { WorkspaceMember } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { relativeTime } from '../lib/utils'
import { ActivityTimeline } from './ActivityTimeline'
import { Avatar } from './Avatar'

export interface CommentThreadProps {
  /** null while the bug is still optimistic (not yet persisted). */
  bugId: string | null
  members: WorkspaceMember[]
}

/** Live activity timeline + comment thread for one bug (backed by useBug). */
export function CommentThread({ bugId, members }: CommentThreadProps) {
  const { comments, events, addComment, loading } = useBug(bugId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(members.map((m) => [m.user_id, m.profile]))

  async function send() {
    const submitted = draft
    const body = submitted.trim()
    if (!body || sending || !bugId) return
    setSending(true)
    setError(null)
    try {
      await addComment(body)
      // The textarea stays editable while posting: drop only the text that was sent and keep
      // anything typed after it. If the sent text was itself edited meanwhile, keep everything.
      setDraft((cur) =>
        cur.startsWith(submitted) ? cur.slice(submitted.length).replace(/^\s+/, '') : cur,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment.')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      <section className="border-t border-border px-6 py-4">
        <h2 className="mb-3 text-sm font-medium text-fg">Activity</h2>
        {loading && events.length === 0 ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <ActivityTimeline events={events} members={members} />
        )}
      </section>
      <section className="border-t border-border px-6 py-4">
        <h2 className="mb-3 text-sm font-medium text-fg">Comments</h2>
        {comments.length > 0 && (
          <ul className="mb-4 space-y-4">
            {comments.map((c) => {
              const profile = byId.get(c.author_id) ?? null
              return (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar profile={profile} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      <span className="font-medium text-fg">
                        {profile?.display_name ?? 'Deleted user'}
                      </span>{' '}
                      ·{' '}
                      <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>
                        {relativeTime(c.created_at)}
                      </time>
                    </p>
                    <Markdown source={c.body} className="mt-0.5" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!bugId}
          rows={2}
          aria-label="Comment"
          placeholder={bugId ? 'Leave a comment…' : 'Comments open once the bug is saved'}
          className="w-full resize-none rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>Enter to send · Shift+Enter for a new line</span>
          {sending && <span>Sending…</span>}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </>
  )
}
