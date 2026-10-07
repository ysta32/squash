import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { useBug } from '../hooks/useBug'
import type { WorkspaceMember } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { cn, relativeTime } from '../lib/utils'
import { ActivityTimeline } from './ActivityTimeline'
import { Avatar } from './Avatar'
import { MentionInput } from './MentionInput'
import { Button, Kbd } from './ui'

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

  const canSend = bugId !== null && draft.trim() !== '' && !sending

  return (
    <>
      <section className="min-w-0">
        <h2 className={SECTION_HEADING}>Activity</h2>
        {loading && events.length === 0 ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <ActivityTimeline events={events} members={members} />
        )}
      </section>
      <section className="min-w-0">
        <h2 className={SECTION_HEADING}>
          Comments
          {comments.length > 0 && <span className="ml-1 tabular-nums">{comments.length}</span>}
        </h2>
        {comments.length > 0 && (
          <ul className="mb-5 space-y-5">
            {comments.map((c) => {
              const profile = byId.get(c.author_id) ?? null
              return (
                <li key={c.id} className="flex gap-3">
                  <Avatar profile={profile} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted">
                      <span className="truncate font-medium text-fg">
                        {profile?.display_name ?? 'Deleted user'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time
                        dateTime={c.created_at}
                        title={new Date(c.created_at).toLocaleString()}
                        className="shrink-0"
                      >
                        {relativeTime(c.created_at)}
                      </time>
                    </p>
                    <Markdown source={c.body} className="mt-1 [overflow-wrap:anywhere]" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div
          className={cn(
            't rounded-lg border border-border bg-bg focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent/15',
            !bugId && 'opacity-60',
          )}
        >
          <MentionInput
            value={draft}
            onChange={setDraft}
            onSubmit={() => void send()}
            members={members}
            disabled={!bugId}
            ariaLabel="Comment"
            placeholder={bugId ? 'Leave a comment…' : 'Comments open once the bug is saved'}
          />
          <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-3">
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
              {sending ? (
                'Sending…'
              ) : (
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <Kbd>↵</Kbd> to send
                  <span aria-hidden="true" className="px-0.5">
                    ·
                  </span>
                  <Kbd>⇧</Kbd>
                  <Kbd>↵</Kbd> new line
                </span>
              )}
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canSend}
              onClick={() => void send()}
              title="Send comment (Enter)"
            >
              <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Comment
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </>
  )
}

const SECTION_HEADING = 'mb-3 text-xs font-medium tracking-wide text-muted uppercase'
