import { useEffect, useState } from 'react'
import { Section } from '../ui'
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

  const [saved, setSaved] = useState(0)
  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(0), 2500)
    return () => window.clearTimeout(timer)
  }, [saved])

  return (
    <Section
      title="Appearance"
      description="Personalize the look of Squash on this device."
      footer={
        <span role="status" className="text-sm text-muted">
          {saved ? 'Saved' : 'Changes save automatically'}
        </span>
      }
    >
      <div className="space-y-6">
        <fieldset role="radiogroup" aria-label="Mode">
          <legend className="mb-3 text-sm font-medium">Mode</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ value, label, icon: Icon }) => (
              <label key={value} className="relative flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => {
                    setTheme(value)
                    setSaved(Date.now())
                  }}
                  className="peer sr-only"
                />
                <span className="t flex items-center justify-center gap-2 rounded-md border border-border p-4 text-sm text-muted peer-checked:border-accent peer-checked:bg-accent/5 peer-checked:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  <Icon size={16} aria-hidden /> {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset role="radiogroup" aria-label="Color scheme">
          <legend className="mb-3 text-sm font-medium">Color scheme</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_SCHEMES.map((value) => {
              const info = SCHEME_INFO[value]
              const selected = scheme === value
              return (
                <label key={value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="color-scheme"
                    value={value}
                    aria-label={`Color scheme ${info.label}`}
                    checked={selected}
                    onChange={() => {
                      setScheme(value)
                      setSaved(Date.now())
                    }}
                    className="peer sr-only"
                  />
                  <span className="t flex items-center gap-3 rounded-md border border-border p-3 text-left text-sm peer-checked:border-accent peer-checked:bg-accent/5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
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
                  </span>
                </label>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-muted">
            Saved on this device. Each scheme has a light and a dark version.
          </p>
        </fieldset>
      </div>
    </Section>
  )
}
