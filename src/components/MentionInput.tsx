import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { WorkspaceMember } from '../lib/types'
import { Avatar } from './Avatar'

const MAX_RESULTS = 6
const TOKEN_RE = /(^|\s)@([\w.-]*)$/

export interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  members: WorkspaceMember[]
  placeholder?: string
  disabled?: boolean
  ariaLabel: string
}

/** Display name with whitespace removed so the markdown mention regex matches it. */
function mentionHandle(name: string): string {
  return name.replace(/\s+/g, '')
}

/** Textarea with @mention autocomplete. Enter submits only while the list is closed. */
export function MentionInput({
  value,
  onChange,
  onSubmit,
  members,
  placeholder,
  disabled,
  ariaLabel,
}: MentionInputProps) {
  const listId = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const token = useMemo(() => {
    const m = TOKEN_RE.exec(value.slice(0, caret))
    return m ? { query: m[2], start: caret - m[2].length - 1 } : null
  }, [value, caret])

  const matches = useMemo(() => {
    if (!token) return []
    const q = token.query.toLowerCase()
    const scored = members
      .map((m) => ({ m, name: m.profile.display_name.toLowerCase() }))
      .filter(({ name }) => name.includes(q) || mentionHandle(name).includes(q))
    scored.sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)))
    return scored.slice(0, MAX_RESULTS).map((s) => s.m)
  }, [members, token])

  const open = !dismissed && !disabled && token !== null && matches.length > 0
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))
  const optionId = (i: number) => `${listId}-opt-${i}`

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  })

  function insert(member: WorkspaceMember) {
    if (!token) return
    const insertion = `@${mentionHandle(member.profile.display_name)} `
    const next = value.slice(0, token.start) + insertion + value.slice(caret)
    const pos = token.start + insertion.length
    pendingCaret.current = pos
    setCaret(pos)
    setActive(0)
    onChange(next)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((activeIndex + step + matches.length) % matches.length)
        return
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        if (e.nativeEvent.isComposing) return
        e.preventDefault()
        insert(matches[activeIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  function onInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setCaret(e.target.selectionStart)
    setDismissed(false)
    setActive(0)
    onChange(e.target.value)
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onBlur={() => setDismissed(true)}
        disabled={disabled}
        rows={2}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        placeholder={placeholder}
        className="w-full resize-none rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated"
        >
          {matches.map((m, i) => (
            <li
              key={m.user_id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                insert(m)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm ${
                i === activeIndex ? 'bg-bg-subtle text-fg' : 'text-fg'
              }`}
            >
              <Avatar profile={m.profile} size="xs" />
              <span className="truncate">{m.profile.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
