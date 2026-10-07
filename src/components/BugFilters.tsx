import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, CircleDashed, Download, X } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss'
import { useOverlayOpen } from '../hooks/useKeyboard'
import type { BugFilters as Filters } from '../hooks/useBugs'
import { bugsToCsv, bugsToMarkdown, downloadText, exportFilename } from '../lib/export'
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/types'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { Button } from './ui'

export interface BugFiltersProps {
  filters: Filters
  onFilters: (filters: Filters) => void
  members: WorkspaceMember[]
  selfId?: string
  bugs?: BugWithMeta[]
  workspaceName?: string
  onExport?: (format: 'csv' | 'md') => void
}

export function BugFilters({
  filters,
  onFilters,
  members,
  selfId,
  bugs = [],
  workspaceName,
  onExport,
}: BugFiltersProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const closeExport = useCallback(() => setExportOpen(false), [])
  useDismiss(exportRef, closeExport, exportOpen)
  const active =
    filters.filedBy || filters.resolvedBy || filters.assignee || filters.severity || filters.query
  const self = selfId ? members.find((member) => member.user_id === selfId) : undefined

  const personOptions: FilterOption[] = members.map((member) => ({
    value: member.user_id,
    label: member.profile.display_name,
    icon: <Avatar profile={member.profile} size="xs" />,
  }))
  const assigneeOptions: FilterOption[] = [
    {
      value: 'none',
      label: 'Unassigned',
      icon: <CircleDashed size={16} strokeWidth={1.75} className="text-muted" />,
    },
    ...(self
      ? [{ value: self.user_id, label: 'Me', icon: <Avatar profile={self.profile} size="xs" /> }]
      : []),
    ...personOptions.filter((option) => option.value !== self?.user_id),
  ]
  const severityOptions: FilterOption[] = SEVERITIES.map((severity) => ({
    value: severity,
    label: SEVERITY_LABEL[severity],
    icon: <span className={cn('h-2 w-2 rounded-full', SEVERITY_COLOR[severity])} />,
  }))

  function exportBugs(format: 'csv' | 'md'): void {
    closeExport()
    triggerRef.current?.focus()
    if (onExport) {
      onExport(format)
    } else if (workspaceName !== undefined) {
      downloadText(
        exportFilename(workspaceName, format),
        format === 'csv' ? bugsToCsv(bugs) : bugsToMarkdown(bugs, workspaceName),
        format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
      )
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div
        role="group"
        aria-label="Filters"
        className="-m-1 flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto p-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        <FilterMenu
          label="Filed by"
          anyLabel="Anyone"
          value={filters.filedBy}
          options={personOptions}
          onChange={(filedBy) => onFilters({ ...filters, filedBy })}
        />
        <FilterMenu
          label="Assignee"
          anyLabel="Anyone"
          value={filters.assignee}
          options={assigneeOptions}
          onChange={(assignee) => onFilters({ ...filters, assignee })}
        />
        <FilterMenu
          label="Severity"
          anyLabel="Any severity"
          value={filters.severity}
          options={severityOptions}
          onChange={(value) =>
            onFilters({
              ...filters,
              severity: SEVERITIES.find((severity) => severity === value) ?? null,
            })
          }
        />
        <FilterMenu
          label="Resolved by"
          anyLabel="Anyone"
          value={filters.resolvedBy}
          options={personOptions}
          onChange={(resolvedBy) => onFilters({ ...filters, resolvedBy })}
        />
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() =>
              onFilters({
                ...filters,
                filedBy: null,
                resolvedBy: null,
                assignee: null,
                severity: null,
                query: '',
              })
            }
          >
            <X size={12} aria-hidden="true" /> Clear
          </Button>
        )}
      </div>
      <div ref={exportRef} className="relative shrink-0">
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          className="px-2"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          aria-controls={exportOpen ? menuId : undefined}
          onClick={() => setExportOpen((open) => !open)}
        >
          <Download size={14} aria-hidden="true" /> Export
        </Button>
        {exportOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label="Export bugs"
            className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated"
            onKeyDown={(event) => {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
              )
              const index = items.indexOf(document.activeElement as HTMLButtonElement)
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                items[next]?.focus()
              } else if (event.key === 'Escape') {
                triggerRef.current?.focus()
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) closeExport()
            }}
          >
            {(['csv', 'md'] as const).map((format, index) => (
              <Button
                key={format}
                autoFocus={index === 0}
                role="menuitem"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => exportBugs(format)}
              >
                {format === 'csv' ? 'CSV' : 'Markdown'}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FilterOption {
  value: string
  label: string
  icon?: ReactNode
}

interface FilterMenuProps {
  label: string
  /** Label of the first option, which clears the filter. */
  anyLabel: string
  value: string | null
  options: FilterOption[]
  onChange: (value: string | null) => void
}

const GAP = 4
const EDGE = 8

/**
 * Compact filter chip that opens a single-select listbox. The popup is portaled with fixed
 * positioning so the horizontally scrolling filter row never clips it.
 */
function FilterMenu({ label, anyLabel, value, options, onChange }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const groupRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const listId = useId()
  useOverlayOpen(open)

  const all: (Omit<FilterOption, 'value'> & { value: string | null })[] = [
    { value: null, label: anyLabel },
    ...options,
  ]
  const current = value ? options.find((option) => option.value === value) : undefined
  const selectedIndex = Math.max(
    0,
    all.findIndex((option) => option.value === value),
  )
  const optionId = (index: number) => `${listId}-option-${index}`

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  function show(index = selectedIndex): void {
    setActiveIndex(index)
    setOpen(true)
  }

  function choose(index: number): void {
    const option = all[index]
    if (!option) return
    close(true)
    if (option.value !== value) onChange(option.value)
  }

  const place = useCallback(() => {
    const anchor = groupRef.current
    const list = listRef.current
    if (!anchor || !list) return
    const rect = anchor.getBoundingClientRect()
    const width = list.offsetWidth
    const height = list.offsetHeight
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))
    const below = rect.bottom + GAP
    const top =
      below + height > window.innerHeight - EDGE && rect.top - GAP - height >= EDGE
        ? rect.top - GAP - height
        : below
    list.style.left = `${left}px`
    list.style.top = `${top}px`
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    listRef.current?.focus({ preventScroll: true })
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (groupRef.current?.contains(target) || listRef.current?.contains(target)) return
      close(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, place, close])

  useEffect(() => {
    if (!open) return
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex, listId])

  function onListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const last = all.length - 1
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(last, index + 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(0, index - 1))
        return
      case 'Home':
      case 'PageUp':
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
      case 'PageDown':
        event.preventDefault()
        setActiveIndex(last)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(activeIndex)
        return
      case 'Escape':
        // Consumed: global Esc shortcuts underneath ignore defaultPrevented events.
        event.preventDefault()
        event.stopPropagation()
        close(true)
        return
      case 'Tab':
        event.preventDefault()
        close(true)
        return
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = event.timeStamp
      const text = (now - typeahead.current.at < 600 ? typeahead.current.text : '') + event.key
      typeahead.current = { text: text.toLowerCase(), at: now }
      const match = all.findIndex((option) =>
        option.label.toLowerCase().startsWith(typeahead.current.text),
      )
      if (match >= 0) setActiveIndex(match)
    }
  }

  return (
    <div
      ref={groupRef}
      className={cn(
        't inline-flex h-7 shrink-0 items-center rounded-md border text-xs',
        value
          ? 'border-accent/30 bg-accent/10 text-fg'
          : 'border-border text-muted hover:bg-bg-subtle hover:text-fg',
        open && !value && 'bg-bg-subtle text-fg',
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            show(event.key === 'ArrowUp' ? all.length - 1 : selectedIndex)
          }
        }}
        className={cn(
          'focus-ring inline-flex h-full max-w-48 items-center gap-1.5 whitespace-nowrap',
          value ? 'rounded-l-md pr-1.5' : 'rounded-md pr-1.5',
          current?.icon ? 'pl-1' : 'pl-2',
        )}
      >
        {current?.icon && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {current.icon}
          </span>
        )}
        <span className="truncate">
          {label}
          {value && (
            <>
              : <span className="font-medium">{current?.label ?? 'Former member'}</span>
            </>
          )}
        </span>
        {!value && <ChevronDown size={12} aria-hidden="true" className="shrink-0 opacity-70" />}
      </button>
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          title={`Clear ${label.toLowerCase()} filter`}
          onClick={() => onChange(null)}
          className="t focus-ring inline-flex h-full items-center rounded-r-md border-l border-accent/20 px-1.5 text-muted hover:bg-accent/10 hover:text-fg"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={optionId(activeIndex)}
            onKeyDown={onListKeyDown}
            onBlur={(event) => {
              const next = event.relatedTarget
              if (next && !event.currentTarget.contains(next) && !groupRef.current?.contains(next))
                close(false)
            }}
            className="fixed left-0 top-0 z-50 max-h-72 min-w-44 max-w-64 overflow-y-auto rounded-lg border border-border bg-bg-elevated p-1 text-sm text-fg shadow-elevated outline-none"
          >
            {all.map((option, index) => {
              const selected = index === selectedIndex
              return (
                <div
                  key={option.value ?? ''}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  aria-label={option.label}
                  onPointerMove={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                  className={cn(
                    'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2',
                    index === activeIndex && 'bg-bg-subtle',
                    option.value === null && 'text-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
                  >
                    {option.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={cn('shrink-0 text-accent', !selected && 'invisible')}
                  />
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
