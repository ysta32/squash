import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { isTypingTarget } from '../hooks/useKeyboard'
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
  success: <CircleCheck className="size-4 text-success" />,
  error: <CircleAlert className="size-4 text-danger" />,
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
      className="pointer-events-auto flex w-full animate-[toast-in_150ms_ease-out] items-start gap-2.5 rounded-lg border border-border bg-bg-elevated py-2 pr-2 pl-3 text-sm text-fg shadow-elevated"
    >
      {icon ? (
        <span aria-hidden="true" className="flex h-6 shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 py-0.5 leading-5 break-words">{item.msg}</span>
      {item.action && (
        <button
          type="button"
          className="focus-ring rounded-md px-2 py-0.5 text-accent hover:bg-bg-subtle"
          onClick={() => activate(item)}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
        className="t focus-ring flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const currentItems = useRef<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    currentItems.current = currentItems.current.filter((t) => t.id !== id)
    setItems(currentItems.current)
  }, [])

  const toast = useCallback((msg: string, opts?: ToastOptions) => {
    const id = nextId.current++
    const item: ToastItem = {
      id,
      msg,
      icon: opts?.icon,
      tone: opts?.tone ?? 'neutral',
      action: opts?.action,
      duration: opts?.duration ?? TOAST_DURATION_MS,
    }
    currentItems.current = [...currentItems.current, item].slice(-MAX_TOASTS)
    setItems(currentItems.current)
  }, [])

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
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
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
