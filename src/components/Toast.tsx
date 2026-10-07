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

export const TOAST_DURATION_MS = 4000
export const MAX_TOASTS = 3

export type ToastTone = 'neutral' | 'success' | 'error'

export interface ToastOptions {
  /** Custom leading icon; overrides the tone's default icon. */
  icon?: ReactNode
  /** Adds a leading status icon (success / error). Neutral toasts have none. */
  tone?: ToastTone
}

interface ToastItem {
  id: number
  msg: string
  icon?: ReactNode
  tone: ToastTone
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.current.delete(id)
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (msg: string, opts?: ToastOptions) => {
      const id = nextId.current++
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      )
      // Oldest toasts beyond the cap are dropped; their pending timers expire harmlessly.
      setItems((list) =>
        [...list, { id, msg, icon: opts?.icon, tone: opts?.tone ?? 'neutral' }].slice(-MAX_TOASTS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
      map.clear()
    }
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 sm:right-4 sm:left-auto sm:translate-x-0"
      >
        {items.map((t) => {
          const icon = t.icon ?? TONE_ICON[t.tone]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full animate-[toast-in_150ms_ease-out] items-start gap-2.5 rounded-lg border border-border bg-bg-elevated py-2 pr-2 pl-3 text-sm text-fg shadow-elevated"
            >
              {icon ? (
                <span aria-hidden="true" className="flex h-6 shrink-0 items-center">
                  {icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 py-0.5 leading-5 break-words">{t.msg}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className="t focus-ring flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
