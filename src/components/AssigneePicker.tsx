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
  /** compact: inline text trigger; toolbar: property control for the bug detail toolbar. */
  variant?: 'compact' | 'toolbar'
  /** Which edge of the trigger the menu aligns to. */
  align?: 'start' | 'end'
  /** Opens upwards, for triggers at the bottom of a pane. */
  side?: 'below' | 'above'
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
  variant = 'compact',
  align = 'end',
  side = 'below',
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
        className={cn(
          't focus-ring inline-flex items-center rounded-md hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-60',
          variant === 'toolbar'
            ? 'h-8 gap-2 px-2 text-sm font-medium pointer-coarse:h-11'
            : '-mx-1 h-6 gap-1.5 px-1 text-xs',
          open && 'bg-surface-3',
        )}
      >
        {current ? (
          <>
            {variant === 'compact' && <span className="text-ink-3">Assigned to</span>}
            <span aria-hidden="true" className="inline-flex">
              <Avatar profile={current.profile} size="xs" />
            </span>
            <span className="max-w-40 truncate text-ink">{current.profile.display_name}</span>
          </>
        ) : (
          <>
            <UserPlus
              size={16}
              strokeWidth={1.5}
              absoluteStrokeWidth
              aria-hidden="true"
              className="text-ink-3"
            />
            <span className="text-ink-2">Assign</span>
          </>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          absoluteStrokeWidth
          aria-hidden="true"
          className={cn('t text-ink-3', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          className={cn(
            'panel absolute z-30 w-56 animate-in p-1',
            side === 'above' ? 'bottom-full mb-1' : 'top-full mt-1',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
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
            {options.length === 0 && <p className="px-2 py-1.5 text-xs text-ink-3">No matches</p>}
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
                    'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-ink pointer-coarse:h-11',
                    index === activeIndex && 'bg-surface-3',
                  )}
                >
                  {option.userId === null ? (
                    <UserMinus
                      size={16}
                      strokeWidth={1.5}
                      absoluteStrokeWidth
                      aria-hidden="true"
                      className="text-ink-3"
                    />
                  ) : (
                    <span aria-hidden="true" className="inline-flex">
                      <Avatar profile={option.profile} size="xs" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected && (
                    <Check
                      size={16}
                      strokeWidth={1.5}
                      absoluteStrokeWidth
                      aria-hidden="true"
                      className="text-ink-2"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
