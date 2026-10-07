import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, UserMinus, UserPlus } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss'
import type { Profile, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { inputClass } from './ui'

/** Above this many members the list gets a type-to-filter input. */
const FILTER_THRESHOLD = 5

export interface AssigneePickerProps {
  members: WorkspaceMember[]
  /** Assignee user id, or null when unassigned. */
  value: string | null
  onChange: (userId: string | null) => void
  selfId: string
  disabled?: boolean
  /** Counter bumped by the keyboard shortcut to open the picker (initial value is ignored). */
  openRequest?: number
}

interface Option {
  key: string
  userId: string | null
  label: string
  match: string
  profile: Profile | null
}

export function AssigneePicker({
  members,
  value,
  onChange,
  selfId,
  disabled = false,
  openRequest,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [seenRequest, setSeenRequest] = useState(openRequest)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const self = members.find((m) => m.user_id === selfId)
  const current = value ? (members.find((m) => m.user_id === value) ?? null) : null
  const filterable = members.length > FILTER_THRESHOLD

  const all: Option[] = [
    ...(self
      ? [
          {
            key: 'self',
            userId: selfId,
            label: 'Assign to me',
            match: `assign to me ${self.profile.display_name}`,
            profile: self.profile,
          },
        ]
      : []),
    ...members
      .filter((m) => m.user_id !== selfId)
      .map((m) => ({
        key: m.user_id,
        userId: m.user_id,
        label: m.profile.display_name,
        match: m.profile.display_name,
        profile: m.profile,
      })),
    ...(value !== null
      ? [{ key: 'none', userId: null, label: 'Unassign', match: 'unassign', profile: null }]
      : []),
  ]
  const q = query.trim().toLowerCase()
  const options = q ? all.filter((o) => o.match.toLowerCase().includes(q)) : all
  const activeIndex = Math.min(active, options.length - 1)

  const show = useCallback(() => {
    setQuery('')
    setActive(0)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, close, open)

  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest)
    if (!disabled && !open) {
      setQuery('')
      setActive(0)
      setOpen(true)
    }
  }

  useEffect(() => {
    if (!open) return
    if (filterable) inputRef.current?.focus()
    else listRef.current?.focus()
  }, [open, filterable])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, listId])

  function pick(option: Option) {
    setOpen(false)
    triggerRef.current?.focus()
    if (option.userId !== value) onChange(option.userId)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + delta + options.length) % options.length)
    } else if (e.key === 'Home' || e.key === 'End') {
      if (e.currentTarget === inputRef.current) return
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : Math.max(0, options.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = options[activeIndex]
      if (option) pick(option)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const optionId = (index: number) => `${listId}-${index}`
  const activeId = options[activeIndex] ? optionId(activeIndex) : undefined

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Assignee: ${current ? current.profile.display_name : 'Unassigned'}`}
        title="Assignee (A)"
        onClick={() => (open ? close() : show())}
        className="t focus-ring -mx-1 inline-flex h-6 items-center gap-1.5 rounded-md px-1 text-xs hover:bg-bg-subtle disabled:pointer-events-none disabled:opacity-50"
      >
        {current ? (
          <>
            <span className="text-muted">Assigned to</span>
            <span aria-hidden="true" className="inline-flex">
              <Avatar profile={current.profile} size="xs" />
            </span>
            <span className="max-w-32 truncate text-fg">{current.profile.display_name}</span>
          </>
        ) : (
          <>
            <UserPlus size={14} aria-hidden="true" className="text-muted" />
            <span className="text-muted">Assign</span>
          </>
        )}
        <ChevronDown size={12} aria-hidden="true" className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated">
          {filterable && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              aria-label="Filter people"
              aria-controls={listId}
              aria-activedescendant={activeId}
              placeholder="Filter people…"
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              className={cn(inputClass, 'mb-1 h-8 text-xs')}
            />
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Assignee"
            tabIndex={filterable ? -1 : 0}
            aria-activedescendant={filterable ? undefined : activeId}
            onKeyDown={onKeyDown}
            className="max-h-64 overflow-y-auto outline-none"
          >
            {options.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">No matches</p>}
            {options.map((option, index) => {
              const selected = option.userId !== null && option.userId === value
              return (
                <div
                  key={option.key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm',
                    index === activeIndex && 'bg-bg-subtle',
                  )}
                >
                  {option.userId === null ? (
                    <UserMinus size={14} aria-hidden="true" className="text-muted" />
                  ) : (
                    <span aria-hidden="true" className="inline-flex">
                      <Avatar profile={option.profile} size="xs" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected && <Check size={14} aria-hidden="true" className="text-accent" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
