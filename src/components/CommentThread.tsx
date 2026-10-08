import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useBug } from '../hooks/useBug'
import type { BugEvent, Comment, Profile, WorkspaceMember } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { cn, relativeTime } from '../lib/utils'
import { ActivityEntry, TIMELINE_GLYPH, TIMELINE_ITEM, TimelineRail } from './ActivityTimeline'
import { Avatar } from './Avatar'
import { MentionInput } from './MentionInput'
import { Button, Kbd } from './ui'

type Entry =
  { kind: 'event'; at: string; event: BugEvent } | { kind: 'comment'; at: string; comment: Comment }

/**
 * Activity and comments as one chronological timeline. "commented" events are dropped: the
 * comment itself is the entry. Ties keep activity before comments (the sort is stable).
 */
function mergeTimeline(events: BugEvent[], comments: Comment[]): Entry[] {
  return [
    ...events
      .filter((e) => e.type !== 'commented')
      .map((event): Entry => ({ kind: 'event', at: event.created_at, event })),
    ...comments.map((comment): Entry => ({ kind: 'comment', at: comment.created_at, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at))
}

export interface CommentThreadProps {
  /** null while the bug is still optimistic (not yet persisted). */
  bugId: string | null
  members: WorkspaceMember[]
  /** The signed-in user: their own comments can be edited and deleted. */
  selfId?: string | null
  /**
   * The resolution note the detail header already quotes. The latest "resolved" event with this
   * note shows without it, so the note is not printed twice.
   */
  headerNote?: string | null
}

/** Live activity timeline + comment thread for one bug (backed by useBug). */
export function CommentThread({
  bugId,
  members,
  selfId = null,
  headerNote = null,
}: CommentThreadProps) {
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

  const names = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
  const entries = mergeTimeline(events, comments)
  let quotedEventId: string | null = null
  if (headerNote) {
    for (const entry of entries) {
      if (entry.kind === 'event' && entry.event.type === 'resolved') quotedEventId = entry.event.id
    }
  }

  return (
    <section aria-labelledby="timeline-heading" className="min-w-0">
      <h2 id="timeline-heading" className={SECTION_HEADING}>
        Timeline
        {comments.length > 0 && (
          <span className="text-ink-3">
            {' '}
            · {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </h2>
      {loading && entries.length === 0 ? (
        <div role="status" aria-label="Loading timeline" className="space-y-3">
          <div className="h-4 w-1/2 animate-skeleton rounded-sm bg-surface-3" />
          <div className="h-4 w-1/3 animate-skeleton rounded-sm bg-surface-3" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-ink-3">No activity yet.</p>
      ) : (
        <ol aria-label="Timeline">
          {entries.map((entry, i) => {
            const last = i === entries.length - 1
            if (entry.kind === 'event') {
              return (
                <ActivityEntry
                  key={entry.event.id}
                  event={entry.event}
                  names={names}
                  last={last}
                  hideNote={entry.event.id === quotedEventId && entry.event.note === headerNote}
                />
              )
            }
            const c = entry.comment
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
                last={last}
              />
            )
          })}
        </ol>
      )}
      <div
        className={cn(
          // A quiet hairline at rest, so the box never reads as focused or outweighs Resolve;
          // the accent ring arrives with focus.
          't mt-6 rounded-lg border border-line-2 bg-surface-2 not-focus-within:hover:border-line-input focus-within:border-focus focus-within:ring-1 focus-within:ring-focus',
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
          <span className="flex min-w-0 items-center gap-1 text-xs text-ink-3">
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
            variant="secondary"
            size="sm"
            disabled={!canSend}
            onClick={() => void send()}
            title="Send comment (Enter)"
            // Empty: plain unavailable text with no outline; a secondary button once there is text.
            className="pointer-coarse:h-[3.1429rem] pointer-coarse:px-4 disabled:border-transparent!"
          >
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
  last?: boolean
}

function CommentItem({
  comment: c,
  profile,
  members,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  last = false,
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
    <li className={cn(TIMELINE_ITEM, 'group', !last && 'pb-6')}>
      {!last && <TimelineRail />}
      <span className={TIMELINE_GLYPH}>
        <Avatar profile={profile} size="xs" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 min-w-0 items-center gap-1.5 text-xs text-ink-3">
          <span className="truncate text-sm font-medium text-ink">
            {profile?.display_name ?? 'Deleted user'}
          </span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={c.created_at}
            title={new Date(c.created_at).toLocaleString()}
            className="shrink-0 font-mono"
          >
            {relativeTime(c.created_at)}
          </time>
          {c.edited_at && (
            <span className="shrink-0" title={`Edited ${new Date(c.edited_at).toLocaleString()}`}>
              (edited)
            </span>
          )}
          {!editing && !confirming && (canEdit || canDelete) && (
            <span className="t ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
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
                  <Pencil size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
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
                  <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
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
            className="t mt-2 rounded-lg border border-line-input bg-surface-2 focus-within:border-focus"
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
          <div className="mt-1 max-w-[68ch] text-ink [&>div]:text-read [&>div]:leading-[1.7143rem]">
            <Markdown source={c.body} className="[overflow-wrap:anywhere]" />
          </div>
        )}
        {confirming && (
          <div
            role="group"
            aria-label="Confirm delete"
            className="mt-2 flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="text-ink-2">Delete this comment? This cannot be undone.</span>
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
  't focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:h-[3.1429rem] pointer-coarse:w-[3.1429rem]'

const SECTION_HEADING = 'specimen-label mb-4 text-ink-3'
