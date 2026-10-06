import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { COLOR_SCHEMES, SCHEME_INFO, useColorScheme, useTheme, type Theme } from '../../lib/theme'

const MODES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function AppearanceSettings() {
  const { theme, resolved, setTheme } = useTheme()
  const { scheme, setScheme } = useColorScheme()

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-medium">Appearance</h2>
      <fieldset>
        <legend className="mb-3">Mode</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={`t inline-flex items-center gap-2 rounded-md border px-3 py-2 ${theme === value ? 'border-accent text-fg' : 'border-border text-muted hover:text-fg'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3">Color scheme</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_SCHEMES.map((value) => {
            const info = SCHEME_INFO[value]
            const selected = scheme === value
            return (
              <button
                key={value}
                type="button"
                aria-label={`Color scheme ${info.label}`}
                aria-pressed={selected}
                onClick={() => setScheme(value)}
                className={`t flex items-center gap-3 rounded-lg border p-3 text-left ${selected ? 'border-accent ring-1 ring-accent' : 'border-border hover:bg-bg-subtle'}`}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border"
                  style={{ backgroundColor: info.bg[resolved] }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: info.accent[resolved] }}
                  >
                    {selected && <Check size={12} color={info.bg[resolved]} strokeWidth={3} />}
                  </span>
                </span>
                <span>{info.label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          Saved on this device. Each scheme has a light and a dark version.
        </p>
      </fieldset>
    </div>
  )
}
