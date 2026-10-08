import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { isOverlayOpen, isTypingTarget } from '../hooks/useKeyboard'
import { isMac } from '../lib/utils'

export const TOAST_DURATION_MS = 5000
export const MAX_TOASTS = 3

export type ToastTone = 'neutral' | 'success' | 'error'

export interface ToastOptions {
  /** Custom leading icon; overrides the tone's default icon. */
  icon?: ReactNode
  /** Adds a leading status icon (success / error). Neutral toasts have none. */
  tone?: ToastTone
  action?: { label: string; onAction: () => void }
  duration?: number
}

interface ToastItem {
  id: number
  msg: string
  icon?: ReactNode
  tone: ToastTone
  action?: ToastOptions['action']
  duration: number
}

interface ToastContextValue {
  toast(msg: string, opts?: ToastOptions): void
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  neutral: null,
  success: <CircleCheck size={16} absoluteStrokeWidth strokeWidth={1.5} className="text-success" />,
  error: <CircleAlert size={16} absoluteStrokeWidth strokeWidth={1.5} className="text-danger" />,
}

const EXIT_MS = 110
const SHIFT_MS = 160

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true
}

/** Web Animations is the only motion path; environments without it (and reduced motion) skip it. */
function canAnimate(): boolean {
  return typeof Element.prototype.animate === 'function' && !prefersReducedMotion()
}

/**
 * Plays a removed toast's exit on a detached, inert snapshot so the real node (and its text) leaves
 * the DOM and the accessibility tree immediately, as before.
 */
function playExit(node: HTMLElement) {
  const rect = node.getBoundingClientRect()
  const ghost = node.cloneNode(true) as HTMLElement
  ghost.removeAttribute('role')
  ghost.removeAttribute('aria-live')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.inert = true
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    margin: '0',
    zIndex: '50',
    pointerEvents: 'none',
    animation: 'none',
  })
  document.body.append(ghost)
  const animation = ghost.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(4px)' },
    ],
    { duration: EXIT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
  )
  const remove = () => ghost.remove()
  animation.finished.then(remove, remove)
}

const ToastContext = createContext<ToastContextValue | null>(null)

function Notification({
  item,
  dismiss,
  activate,
}: {
  item: ToastItem
  dismiss: (id: number) => void
  activate: (item: ToastItem) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remaining = useRef(item.duration)
  const paused = hovered || focused
  useEffect(() => {
    if (paused || item.tone === 'error') return
    const started = Date.now()
    const timer = setTimeout(() => dismiss(item.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - started))
    }
  }, [paused, item.id, item.tone, dismiss])
  const icon = item.icon ?? TONE_ICON[item.tone]
  return (
    <div
      role={item.tone === 'error' ? 'alert' : undefined}
      aria-live={item.tone === 'error' ? 'assertive' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      data-toast-id={item.id}
      className="pointer-events-auto flex min-h-11 w-full animate-[toast-in_var(--dur-standard)_var(--ease-out)] items-center gap-3 rounded-lg border border-line bg-surface-2 py-1.5 pr-1.5 pl-4 text-sm text-ink shadow-elev-2"
    >
      {icon ? (
        <span aria-hidden="true" className="-ml-1 flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 py-1 break-words">{item.msg}</span>
      {item.action && (
        <button
          type="button"
          className="t focus-ring h-8 shrink-0 rounded-md px-2.5 font-medium text-accent hover:bg-surface-3 pointer-coarse:h-[3.1429rem]"
          onClick={() => activate(item)}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
        className="t focus-ring flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink pointer-coarse:size-[3.1429rem]"
      >
        <X size={14} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const currentItems = useRef<ToastItem[]>([])
  const region = useRef<HTMLDivElement>(null)
  // Where focus was before it entered the toast stack, restored if the focused toast goes away.
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const target = returnFocus.current
    if (!target) return
    const active = document.activeElement
    if (active && active !== document.body && region.current?.contains(active)) return
    returnFocus.current = null
    if ((!active || active === document.body) && target.isConnected) target.focus()
  }, [items])

  // Positions before a change, so the toasts that stay can glide (transform only) to their new place.
  const before = useRef<Map<string, number> | null>(null)

  /** Records layout and plays exits for `removed` before the list changes. */
  const prepare = useCallback((removed: number[]) => {
    const root = region.current
    if (!root || !canAnimate()) return
    const tops = new Map<string, number>()
    for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-toast-id]'))) {
      const id = node.dataset.toastId ?? ''
      if (removed.includes(Number(id))) playExit(node)
      else tops.set(id, node.getBoundingClientRect().top)
    }
    before.current = tops
  }, [])

  useLayoutEffect(() => {
    const tops = before.current
    before.current = null
    const root = region.current
    if (!tops || !root) return
    for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-toast-id]'))) {
      const top = tops.get(node.dataset.toastId ?? '')
      if (top === undefined) continue
      const delta = top - node.getBoundingClientRect().top
      if (Math.abs(delta) < 1) continue
      node.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], {
        duration: SHIFT_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      })
    }
  }, [items])

  const dismiss = useCallback(
    (id: number) => {
      if (!currentItems.current.some((t) => t.id === id)) return
      prepare([id])
      currentItems.current = currentItems.current.filter((t) => t.id !== id)
      setItems(currentItems.current)
    },
    [prepare],
  )

  const toast = useCallback(
    (msg: string, opts?: ToastOptions) => {
      const id = nextId.current++
      const item: ToastItem = {
        id,
        msg,
        icon: opts?.icon,
        tone: opts?.tone ?? 'neutral',
        action: opts?.action,
        duration: opts?.duration ?? TOAST_DURATION_MS,
      }
      const next = [...currentItems.current, item].slice(-MAX_TOASTS)
      prepare(currentItems.current.filter((t) => !next.includes(t)).map((t) => t.id))
      currentItems.current = next
      setItems(next)
    },
    [prepare],
  )

  const activate = useCallback(
    (item: ToastItem) => {
      if (!currentItems.current.some((t) => t.id === item.id)) return
      dismiss(item.id)
      item.action?.onAction()
    },
    [dismiss],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.shiftKey
      )
        return
      if (event.key.toLowerCase() !== 'z' || !(isMac ? event.metaKey : event.ctrlKey)) return
      if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return
      // Undo acts on the page behind; never while a dialog or popover is in front of it.
      if (isOverlayOpen()) return
      const item = [...currentItems.current]
        .reverse()
        .find((t) => t.action?.label.toLowerCase() === 'undo')
      if (!item) return
      event.preventDefault()
      activate(item)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activate])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={region}
        onFocus={(event) => {
          const from = event.relatedTarget
          if (from instanceof HTMLElement && !event.currentTarget.contains(from))
            returnFocus.current = from
        }}
        aria-live="polite"
        role="status"
        // Clears what is pinned to the bottom of the screen: the phone bug-detail action bar
        // (--bottom-bar-h, which already includes the safe-area inset, then 12px of air) and the
        // bug list footer under the bottom-left corner (--list-footer-h, then 8px). Each publishes
        // its height only while it is shown; with neither, the toast sits 16px off the edge.
        className="pointer-events-none fixed bottom-[max(calc(16px+env(safe-area-inset-bottom)),calc(var(--list-footer-h,0px)+8px+env(safe-area-inset-bottom)),calc(var(--bottom-bar-h,0px)+12px))] left-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((item) => (
          <Notification key={item.id} item={item} dismiss={dismiss} activate={activate} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
