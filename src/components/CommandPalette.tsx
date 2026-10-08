import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowLeftRight,
  Bug,
  CircleHelp,
  CornerDownLeft,
  Lightbulb,
  Search,
  Settings2,
  Download,
  ListFilter,
  SlidersHorizontal,
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
  /**
   * Accession number such as "#24" that the label starts with. It replaces the icon and is set
   * in a fixed mono column so bug titles line up.
   */
  accession?: string
  run: () => void
}

const GROUP_ICON: Record<string, LucideIcon> = {
  Actions: CornerDownLeft,
  Navigate: ListFilter,
  Export: Download,
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

/** The label without its leading accession number, or null when the command has none. */
function accessionTitle(command: Command): string | null {
  const prefix = command.accession ? `${command.accession} ` : null
  return prefix && command.label.startsWith(prefix) ? command.label.slice(prefix.length) : null
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim p-3 pt-[12vh] transition-opacity duration-(--dur-standard) ease-out starting:opacity-0 sm:p-4 sm:pt-[20vh]"
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
        className="w-full max-w-160 overflow-hidden rounded-xl border border-line bg-surface-2/92 text-ink shadow-elev-3 backdrop-blur-lg backdrop-saturate-150 transition-[opacity,transform] duration-(--dur-emphasis) ease-out starting:translate-y-1 starting:opacity-0"
      >
        <div className="flex h-12 items-center gap-3 border-b border-line px-4">
          <Search
            size={16}
            absoluteStrokeWidth
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-ink-3"
          />
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
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <Kbd className="shrink-0">Esc</Kbd>
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(24rem,56vh)] scroll-py-2 overflow-y-auto overscroll-contain p-2"
        >
          {flat.length === 0 ? (
            <div className="px-2 py-6">
              <p className="text-sm font-medium text-ink">No matching commands</p>
              <p className="mt-1 text-sm text-ink-2">
                Nothing matches <span className="font-mono text-ink">{query.trim()}</span>. Try a
                bug number or a word from its title.
              </p>
            </div>
          ) : (
            groups.map((group, g) => (
              <div
                key={group.name}
                role="group"
                aria-labelledby={`${baseId}-group-${g}`}
                className="pb-1 not-first:mt-1 not-first:border-t not-first:border-line not-first:pt-1"
              >
                <div id={`${baseId}-group-${g}`} className="specimen-label px-2 pt-2 pb-1.5">
                  {group.name}
                </div>
                {group.items.map((command) => {
                  index += 1
                  const i = index
                  const selected = i === activeIndex
                  const Icon = commandIcon(command)
                  const title = accessionTitle(command)
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
                        'relative flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm select-none pointer-coarse:h-11',
                        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:content-['']",
                        selected ? 'bg-ink/6 text-ink before:bg-accent' : 'text-ink',
                      )}
                    >
                      {title !== null ? (
                        <>
                          <span className="min-w-[4ch] shrink-0 text-right font-mono font-medium text-ink-3 nums">
                            {command.accession}
                          </span>{' '}
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                        </>
                      ) : (
                        <>
                          <Icon
                            aria-hidden="true"
                            size={16}
                            absoluteStrokeWidth
                            strokeWidth={1.5}
                            className={cn('shrink-0', selected ? 'text-ink' : 'text-ink-3')}
                          />
                          <span className="min-w-0 flex-1 truncate">{command.label}</span>
                        </>
                      )}
                      {command.hint && <Kbd className="ml-auto shrink-0">{command.hint}</Kbd>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div
          aria-hidden="true"
          className="hidden h-9 items-center gap-4 border-t border-line px-4 font-mono text-xs text-ink-3 sm:flex"
        >
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> run
          </span>
        </div>
      </div>
    </div>
  )
}
