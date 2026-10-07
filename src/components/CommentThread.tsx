import { useState } from 'react'
import { Pencil, SendHorizontal, Trash2 } from 'lucide-react'
import { useBug } from '../hooks/useBug'
import type { Comment, Profile, WorkspaceMember } from '../lib/types'
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
  /** The signed-in user: their own comments can be edited and deleted. */
  selfId?: string | null
}

/** Live activity timeline + comment thread for one bug (backed by useBug). */
export function CommentThread({ bugId, members, selfId = null }: CommentThreadProps) {
  const { comments, events, addComment, editComment, deleteComment, loading } = useBug(bugId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(members.map((m) => [m.user_id, m.profile]))
  const selfIsOwner =
    selfId !== null && members.some((m) => m.user_id === selfId && m.role === 'owner')

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
              const own = selfId !== null && c.author_id === selfId
              return (
                <CommentItem
                  key={c.id}
                  comment={c}
                  profile={byId.get(c.author_id) ?? null}
                  members={members}
                  canEdit={own}
                  canDelete={own || selfIsOwner}
                  onEdit={(body) => editComment(c.id, body)}
                  onDelete={() => deleteComment(c.id)}
                />
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

interface CommentItemProps {
  comment: Comment
  profile: Profile | null
  members: WorkspaceMember[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
}

function CommentItem({
  comment: c,
  profile,
  members,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = draft !== null

  async function run(action: () => Promise<void>, fallback: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (draft === null || busy) return
    const body = draft.trim()
    if (!body) return
    if (body === c.body) {
      setDraft(null)
      return
    }
    if (await run(() => onEdit(body), 'Could not save comment.')) setDraft(null)
  }

  async function remove() {
    if (busy) return
    // On success the comment leaves the list and this item unmounts.
    if (!(await run(onDelete, 'Could not delete comment.'))) setConfirming(false)
  }

  return (
    <li className="group flex gap-3">
      <Avatar profile={profile} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted">
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
          {c.edited_at && (
            <span className="shrink-0" title={`Edited ${new Date(c.edited_at).toLocaleString()}`}>
              (edited)
            </span>
          )}
          {!editing && !confirming && (canEdit || canDelete) && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setDraft(c.body)
                  }}
                  aria-label="Edit comment"
                  title="Edit comment"
                  className={COMMENT_ACTION}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setConfirming(true)
                  }}
                  aria-label="Delete comment"
                  title="Delete comment"
                  className={cn(COMMENT_ACTION, 'hover:bg-danger/10 hover:text-danger')}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </span>
          )}
        </div>
        {editing ? (
          <div
            role="group"
            aria-label="Editing comment"
            onKeyDown={(e) => {
              // The mention popup handles (and prevents) its own Escape first.
              if (e.key !== 'Escape' || e.defaultPrevented || busy) return
              e.preventDefault()
              setDraft(null)
            }}
            className="t mt-1 rounded-lg border border-border bg-bg focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent/15"
          >
            <MentionInput
              value={draft}
              onChange={setDraft}
              onSubmit={() => void save()}
              members={members}
              disabled={busy}
              ariaLabel="Edit comment"
            />
            <div className="flex items-center justify-end gap-2 py-2 pr-2 pl-3">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={busy || draft.trim() === ''}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <Markdown source={c.body} className="mt-1 [overflow-wrap:anywhere]" />
        )}
        {confirming && (
          <div
            role="group"
            aria-label="Confirm delete"
            className="mt-2 flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="text-muted">Delete this comment? This cannot be undone.</span>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

const COMMENT_ACTION =
  't focus-ring inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-fg/5 hover:text-fg'

const SECTION_HEADING = 'mb-3 text-xs font-medium tracking-wide text-muted uppercase'
