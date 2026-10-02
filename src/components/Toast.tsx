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
import { X } from 'lucide-react'

export const TOAST_DURATION_MS = 4000
export const MAX_TOASTS = 3

interface ToastItem {
  id: number
  msg: string
  icon?: ReactNode
}

interface ToastContextValue {
  toast(msg: string, opts?: { icon?: ReactNode }): void
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
    (msg: string, opts?: { icon?: ReactNode }) => {
      const id = nextId.current++
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      )
      // Oldest toasts beyond the cap are dropped; their pending timers expire harmlessly.
      setItems((list) => [...list, { id, msg, icon: opts?.icon }].slice(-MAX_TOASTS))
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
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm animate-[toast-in_150ms_ease-out] items-center gap-2 rounded-lg border border-border bg-fg px-3 py-2 text-sm text-bg shadow-lg"
          >
            {t.icon ? <span aria-hidden="true">{t.icon}</span> : null}
            <span className="min-w-0 break-words">{t.msg}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
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
