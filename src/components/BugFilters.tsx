import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronDown,
  CircleDashed,
  Download,
  ListFilter,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { useOverlayOpen } from '../hooks/useKeyboard'
import type { BugFilters as Filters, BugSort } from '../hooks/useBugs'
import { bugsToCsv, bugsToMarkdown, downloadText, exportFilename } from '../lib/export'
import { SEVERITIES, SEVERITY_LABEL } from '../lib/types'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { SeverityTicks } from './SeverityTicks'
import { Button, Label, menuItemClass, panelClass } from './ui'

/** An extra entry for the list's `…` menu (e.g. Claude Code actions on narrow screens). */
export interface ListAction {
  id: string
  label: string
  icon: ReactNode
  onSelect: () => void
}

export interface BugFiltersProps {
  filters: Filters
  onFilters: (filters: Filters) => void
  members: WorkspaceMember[]
  selfId?: string
  bugs?: BugWithMeta[]
  workspaceName?: string
  onExport?: (format: 'csv' | 'md') => void
  /** Listed above the export items in the `…` menu. */
  actions?: ListAction[]
}

const SORT_LABEL: Record<Exclude<BugSort, 'newest'>, string> = {
  oldest: 'Oldest',
  severity: 'Severity',
  activity: 'Recently active',
}

/** Filters that narrow the list (search aside). Sort only reorders, so it is not counted here. */
function activeFilterCount(filters: Filters): number {
  return [filters.filedBy, filters.resolvedBy, filters.assignee, filters.severity].filter(Boolean)
    .length
}

function clearedFilters(filters: Filters): Filters {
  return { ...filters, filedBy: null, resolvedBy: null, assignee: null, severity: null, query: '' }
}

interface MenuOptions {
  person: FilterOption[]
  assignee: FilterOption[]
  severity: FilterOption[]
  sort: FilterOption[]
}

function menuOptions(members: WorkspaceMember[], selfId?: string): MenuOptions {
  const self = selfId ? members.find((member) => member.user_id === selfId) : undefined
  const person: FilterOption[] = members.map((member) => ({
    value: member.user_id,
    label: member.profile.display_name,
    icon: <Avatar profile={member.profile} size="xs" />,
  }))
  return {
    person,
    assignee: [
      {
        value: 'none',
        label: 'Unassigned',
        icon: <CircleDashed size={16} strokeWidth={1.5} className="text-ink-3" />,
      },
      ...(self
        ? [{ value: self.user_id, label: 'Me', icon: <Avatar profile={self.profile} size="xs" /> }]
        : []),
      ...person.filter((option) => option.value !== self?.user_id),
    ],
    severity: SEVERITIES.map((severity) => ({
      value: severity,
      label: SEVERITY_LABEL[severity],
      icon: <SeverityTicks severity={severity} />,
    })),
    sort: SORT_VALUES.map((sort) => ({ value: sort, label: SORT_LABEL[sort] })),
  }
}

/**
 * The list's tools next to search (DESIGN.md / round0 (c)): one "Filter" popover holding Filed by,
 * Assignee, Severity, Resolved by and Sort, and a `…` menu for list actions and export. Active
 * filters show as removable chips in <ActiveFilters> under the search row.
 */
export function BugFilters({
  filters,
  onFilters,
  members,
  selfId,
  bugs = [],
  workspaceName,
  onExport,
  actions = [],
}: BugFiltersProps) {
  const options = menuOptions(members, selfId)
  const count = activeFilterCount(filters) + (filters.sort === 'newest' ? 0 : 1)

  function exportBugs(format: 'csv' | 'md'): void {
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
    <>
      <Popover
        label="Filters"
        trigger={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            aria-label={count > 0 ? `Filter, ${count} active` : 'Filter'}
            className={cn('px-2 pointer-coarse:h-[3.1429rem]', count > 0 && 'text-ink')}
          >
            <ListFilter size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="max-[359px]:sr-only">Filter</span>
            {count > 0 && (
              <span
                aria-hidden="true"
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-xs bg-accent-tint px-1 font-mono text-label text-accent tabular-nums"
              >
                {count}
              </span>
            )}
          </Button>
        )}
      >
        {() => (
          <div className="w-[18rem] p-1.5">
            <Label as="div" tone="muted" className="px-1.5 pt-1 pb-2">
              Filter and sort
            </Label>
            <FilterMenu
              label="Filed by"
              anyLabel="Anyone"
              value={filters.filedBy}
              options={options.person}
              onChange={(filedBy) => onFilters({ ...filters, filedBy })}
            />
            <FilterMenu
              label="Assignee"
              anyLabel="Anyone"
              value={filters.assignee}
              options={options.assignee}
              onChange={(assignee) => onFilters({ ...filters, assignee })}
            />
            <FilterMenu
              label="Severity"
              anyLabel="Any severity"
              value={filters.severity}
              options={options.severity}
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
              options={options.person}
              onChange={(resolvedBy) => onFilters({ ...filters, resolvedBy })}
            />
            <div aria-hidden="true" className="mx-1.5 my-1.5 h-px bg-line" />
            <FilterMenu
              label="Sort"
              anyLabel="Newest"
              value={filters.sort === 'newest' ? null : filters.sort}
              options={options.sort}
              onChange={(value) =>
                onFilters({
                  ...filters,
                  sort: SORT_VALUES.find((sort) => sort === value) ?? 'newest',
                })
              }
            />
          </div>
        )}
      </Popover>
      <ActionsMenu
        actions={[
          ...actions,
          {
            id: 'export-csv',
            label: 'Export as CSV',
            icon: <Download size={16} strokeWidth={1.5} />,
            onSelect: () => exportBugs('csv'),
          },
          {
            id: 'export-md',
            label: 'Export as Markdown',
            icon: <Download size={16} strokeWidth={1.5} />,
            onSelect: () => exportBugs('md'),
          },
        ]}
      />
    </>
  )
}

/** Removable chips for the active filters and a non-default sort, plus "Clear" for all filters. */
export function ActiveFilters({
  filters,
  onFilters,
  members,
  selfId,
}: Pick<BugFiltersProps, 'filters' | 'onFilters' | 'members' | 'selfId'>) {
  const options = menuOptions(members, selfId)
  const chips: { label: string; value: string; icon?: ReactNode; clear: Filters }[] = []
  const add = (label: string, value: string | null, list: FilterOption[], clear: Filters) => {
    if (!value) return
    const option = list.find((o) => o.value === value)
    chips.push({ label, value: option?.label ?? 'Former member', icon: option?.icon, clear })
  }
  add('Filed by', filters.filedBy, options.person, { ...filters, filedBy: null })
  add('Assignee', filters.assignee, options.assignee, { ...filters, assignee: null })
  add('Severity', filters.severity, options.severity, { ...filters, severity: null })
  add('Resolved by', filters.resolvedBy, options.person, { ...filters, resolvedBy: null })
  if (filters.sort !== 'newest')
    chips.push({
      label: 'Sort',
      value: SORT_LABEL[filters.sort],
      clear: { ...filters, sort: 'newest' },
    })
  if (chips.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5"
    >
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex h-[1.7143rem] max-w-full items-center rounded-sm border border-line-2 bg-surface-2 pl-1.5 text-xs pointer-coarse:h-[3.1429rem]"
        >
          {chip.icon && (
            <span aria-hidden="true" className="mr-1 inline-flex shrink-0 [&_*]:size-4">
              {chip.icon}
            </span>
          )}
          <span className="truncate">
            <span className="text-ink-3">{chip.label}: </span>
            <span className="font-medium text-ink">{chip.value}</span>
          </span>
          <button
            type="button"
            aria-label={`Clear ${chip.label} filter`}
            title={`Clear ${chip.label.toLowerCase()} filter`}
            onClick={() => onFilters(chip.clear)}
            className="t focus-ring ml-0.5 inline-flex h-full w-6 shrink-0 items-center justify-center rounded-r-sm text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:w-[3.1429rem]"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      {activeFilterCount(filters) > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-[1.7143rem] px-1.5 text-xs pointer-coarse:h-[3.1429rem]"
          onClick={() => onFilters(clearedFilters(filters))}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

/** Shared trigger props for <Popover>. */
interface TriggerProps {
  ref: RefObject<HTMLButtonElement | null>
  'aria-haspopup': 'dialog' | 'menu'
  'aria-expanded': boolean
  'aria-controls': string | undefined
  onClick: () => void
}

/** Marks portaled filter listboxes so the popover treats them as its own content. */
const POPUP_ATTR = 'data-filter-popup'

/**
 * Non-modal popover anchored under its trigger (right-aligned). Closes on Esc (focus returns to the
 * trigger), on an outside press, or when focus leaves it. Portaled filter listboxes count as inside.
 */
function Popover({
  label,
  trigger,
  children,
  role = 'dialog',
}: {
  label: string
  trigger: (props: TriggerProps) => ReactNode
  children: (close: (refocus: boolean) => void) => ReactNode
  role?: 'dialog' | 'menu'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  useOverlayOpen(open)

  // Whether the trigger takes focus back once the panel is closed. Kept as state (not a ref read in
  // `close`) because `close` is handed to the render-time `children` callback.
  const [refocusOnClose, setRefocusOnClose] = useState(false)
  const close = useCallback((refocus: boolean) => {
    setRefocusOnClose(refocus)
    setOpen(false)
  }, [])

  useLayoutEffect(() => {
    if (!open && refocusOnClose) triggerRef.current?.focus()
  }, [open, refocusOnClose])

  const inside = useCallback((node: EventTarget | null) => {
    if (!(node instanceof Node)) return false
    if (wrapRef.current?.contains(node)) return true
    return node instanceof Element && node.closest(`[${POPUP_ATTR}]`) !== null
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!inside(event.target)) close(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      close(true)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close, inside])

  useLayoutEffect(() => {
    if (!open || role !== 'dialog') return
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [open, role])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {trigger({
        ref: triggerRef,
        'aria-haspopup': role,
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: () => {
          setRefocusOnClose(false)
          setOpen((o) => !o)
        },
      })}
      {open && (
        <div
          ref={panelRef}
          id={id}
          role={role === 'dialog' ? 'dialog' : undefined}
          aria-label={role === 'dialog' ? label : undefined}
          onBlur={(event) => {
            if (event.relatedTarget && !inside(event.relatedTarget)) close(false)
          }}
          className={cn(panelClass, 'absolute top-full right-0 z-30 mt-1 animate-in')}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

/** A menu panel with arrow-key / Home / End navigation between its items; Tab closes it. */
function MenuPanel({
  label,
  close,
  className,
  children,
}: {
  label: string
  close: (refocus: boolean) => void
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={cn('p-1', className)}
      onKeyDown={(event) => {
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]'),
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
        } else if (event.key === 'Tab') {
          close(false)
        }
      }}
    >
      {children}
    </div>
  )
}

/** The `…` menu: list actions and export, with arrow-key navigation. */
function ActionsMenu({ actions }: { actions: ListAction[] }) {
  return (
    <Popover
      label="List actions"
      role="menu"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="sm"
          aria-label="List actions"
          title="List actions"
          className="w-[2.2857rem] px-0 pointer-coarse:h-[3.1429rem] pointer-coarse:w-[3.1429rem]"
        >
          <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      )}
    >
      {(close) => (
        <MenuPanel label="List actions" close={close} className="w-[16rem]">
          {actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              autoFocus={index === 0}
              className={menuItemClass}
              onClick={() => {
                close(true)
                action.onSelect()
              }}
            >
              {action.icon}
              <span className="min-w-0 truncate">{action.label}</span>
            </button>
          ))}
        </MenuPanel>
      )}
    </Popover>
  )
}

export type StatusTab = Filters['tab']

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

/**
 * Open / Resolved / All as one "Open ⌄" menu button, for narrow lists (below 480px) where a
 * segmented control would crowd the Bugs / Features tabs.
 */
/**
 * A count in mono text-3. Until counts are known (first load) it is a skeleton block of the same
 * 2ch minimum width, so nothing beside it shifts when the numbers arrive.
 */
export function Count({ value, pending = false }: { value: number; pending?: boolean }) {
  return pending ? (
    <span
      aria-hidden="true"
      data-testid="count-pending"
      className="inline-block h-2.5 w-[2ch] animate-skeleton rounded-xs bg-surface-3 font-mono text-xs"
    />
  ) : (
    <span className="inline-block min-w-[2ch] font-mono text-xs font-normal text-ink-3 tabular-nums">
      {value}
    </span>
  )
}

/**
 * Open / Resolved / All as one compact "Open 6 ⌄" menu at every width: status is a filter on the
 * list, so it reads as a quiet control beside the Bugs / Features tabs rather than as a second
 * row of tabs.
 */
export function StatusMenu({
  tab,
  counts,
  countsPending = false,
  onTab,
  className,
}: {
  tab: StatusTab
  counts: Record<StatusTab, number>
  countsPending?: boolean
  onTab: (tab: StatusTab) => void
  className?: string
}) {
  const current = STATUS_TABS.find((option) => option.value === tab) ?? STATUS_TABS[0]
  return (
    <div className={className}>
      <Popover
        label="Status"
        role="menu"
        trigger={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            aria-label={`Status: ${current.label}`}
            className="gap-1.5 px-2 text-ink pointer-coarse:h-[3.1429rem]"
          >
            {current.label} <Count value={counts[tab]} pending={countsPending} />
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="text-ink-3" />
          </Button>
        )}
      >
        {(close) => (
          <MenuPanel label="Status" close={close} className="w-[12rem]">
            {STATUS_TABS.map((option) => {
              const checked = option.value === tab
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  autoFocus={checked}
                  className={menuItemClass}
                  onClick={() => {
                    close(true)
                    if (!checked) onTab(option.value)
                  }}
                >
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={cn('text-accent', !checked && 'invisible')}
                  />
                  <span className="flex-1">{option.label}</span>{' '}
                  <Count value={counts[option.value]} pending={countsPending} />
                </button>
              )
            })}
          </MenuPanel>
        )}
      </Popover>
    </div>
  )
}

const SORT_VALUES: Exclude<BugSort, 'newest'>[] = ['oldest', 'severity', 'activity']

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
 * One row of the Filter popover ("Filed by   Anyone ⌄") that opens a single-select listbox. The
 * listbox is portaled with fixed positioning so the popover never clips it.
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
    <div ref={groupRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={value ? `${label}: ${current?.label ?? 'Former member'}` : label}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            show(event.key === 'ArrowUp' ? all.length - 1 : selectedIndex)
          }
        }}
        className={cn(
          't focus-ring-inset flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-sm hover:bg-surface-3 pointer-coarse:h-[3.1429rem]',
          open && 'bg-surface-3',
        )}
      >
        <span className="w-[5.5rem] shrink-0 text-ink-2">{label}</span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {current?.icon && (
            <span aria-hidden="true" className="inline-flex shrink-0">
              {current.icon}
            </span>
          )}
          <span className={cn('truncate', value ? 'font-medium text-ink' : 'text-ink-3')}>
            {value ? (current?.label ?? 'Former member') : anyLabel}
          </span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          aria-hidden="true"
          className="shrink-0 text-ink-3"
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={optionId(activeIndex)}
            {...{ [POPUP_ATTR]: '' }}
            onKeyDown={onListKeyDown}
            onBlur={(event) => {
              const next = event.relatedTarget
              if (next && !event.currentTarget.contains(next) && !groupRef.current?.contains(next))
                close(false)
            }}
            className={cn(
              panelClass,
              'fixed top-0 left-0 z-50 max-h-72 min-w-44 max-w-64 overflow-y-auto p-1 text-sm text-ink outline-none',
            )}
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
                    'flex h-8 cursor-default items-center gap-2 rounded-md px-2 select-none pointer-coarse:h-[3.1429rem]',
                    index === activeIndex && 'bg-surface-3',
                    option.value === null && 'text-ink-3',
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
