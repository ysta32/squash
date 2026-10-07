import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowLeftRight,
  Bug,
  CircleHelp,
  CornerDownLeft,
  Lightbulb,
  Search,
  Settings2,
  Share,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { cn } from '../lib/utils'
import { Kbd } from './ui'

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  keywords?: string[]
  /** Leading icon; defaults to the icon of the command's group. */
  icon?: LucideIcon
  run: () => void
}

const GROUP_ICON: Record<string, LucideIcon> = {
  Actions: Zap,
  Export: Share,
  Bugs: Bug,
  Features: Lightbulb,
  'Switch workspace': ArrowLeftRight,
  Workspace: Settings2,
  Help: CircleHelp,
  Preferences: SlidersHorizontal,
}

function commandIcon(command: Command): LucideIcon {
  return command.icon ?? GROUP_ICON[command.group] ?? CornerDownLeft
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Command[]
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return needle.length === 0
}

/** Lower is better: 0 prefix, 1 substring, 2 subsequence; null when the command does not match. */
function matchRank(command: Command, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (q === '') return 0
  const fields = [command.label, ...(command.keywords ?? [])].map((f) => f.toLowerCase())
  if (fields.some((f) => f.startsWith(q))) return 0
  const haystack = fields.join(' ')
  if (haystack.includes(q)) return 1
  if (isSubsequence(q, haystack)) return 2
  return null
}

interface Group {
  name: string
  items: Command[]
}

/** Matching commands grouped by heading; groups keep the order of their best-ranked command. */
function filterCommands(commands: Command[], query: string): Group[] {
  const ranked = commands
    .map((command, index) => ({ command, index, rank: matchRank(command, query) }))
    .filter((r): r is { command: Command; index: number; rank: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
  const groups: Group[] = []
  const byName = new Map<string, Group>()
  for (const { command } of ranked) {
    let group = byName.get(command.group)
    if (!group) {
      group = { name: command.group, items: [] }
      byName.set(command.group, group)
      groups.push(group)
    }
    group.items.push(command)
  }
  return groups
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  useOverlayOpen(open)
  if (!open) return null
  return <PaletteDialog onClose={onClose} commands={commands} />
}

function PaletteDialog({ onClose, commands }: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)
  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const groups = useMemo(() => filterCommands(commands, query), [commands, query])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Tab') {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // A command that moved focus elsewhere (capture bar, search) keeps it.
      const now = document.activeElement
      if (previous?.isConnected && (now === null || now === document.body)) previous.focus()
    }
  }, [])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [baseId, activeIndex])

  const runCommand = (command: Command) => {
    onClose()
    command.run()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + delta + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) runCommand(flat[activeIndex])
    }
  }

  let index = -1
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px] sm:pt-[18vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => {
          if (e.target !== inputRef.current) e.preventDefault()
        }}
        className="w-full max-w-xl animate-in overflow-hidden rounded-xl border border-border bg-bg-elevated text-fg shadow-elevated"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-label="Search commands"
            placeholder="Type a command or search bugs"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(22rem,60vh)] scroll-py-2 overflow-y-auto p-1.5"
        >
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No matching commands</p>
          ) : (
            groups.map((group, g) => (
              <div
                key={group.name}
                role="group"
                aria-labelledby={`${baseId}-group-${g}`}
                className="py-1"
              >
                <div
                  id={`${baseId}-group-${g}`}
                  className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase"
                >
                  {group.name}
                </div>
                {group.items.map((command) => {
                  index += 1
                  const i = index
                  const selected = i === activeIndex
                  const Icon = commandIcon(command)
                  return (
                    <div
                      key={command.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => {
                        if (!selected) setActive(i)
                      }}
                      onClick={() => runCommand(command)}
                      className={cn(
                        'relative flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm select-none',
                        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
                        selected ? 'bg-bg-subtle text-fg before:bg-accent' : 'text-fg/90',
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn('size-4 shrink-0', selected ? 'text-fg' : 'text-muted')}
                      />
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint && <Kbd className="shrink-0">{command.hint}</Kbd>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
