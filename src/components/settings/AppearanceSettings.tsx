import { useEffect, useState } from 'react'
import { Button, Section } from '../ui'
import { useNotifications } from '../../hooks/useNotifications'
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
  const { supported, permission, enabled, setEnabled } = useNotifications()
  const [requesting, setRequesting] = useState(false)

  const [saved, setSaved] = useState(0)
  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(0), 2500)
    return () => window.clearTimeout(timer)
  }, [saved])

  return (
    <div className="space-y-6">
      <Section
        title="Appearance"
        description="Personalize the look of Squash on this device."
        footer={
          <span role="status" className="mr-auto text-sm text-muted">
            {saved ? 'Saved' : 'Changes save automatically'}
          </span>
        }
      >
        <div className="space-y-6">
          <fieldset role="radiogroup" aria-label="Mode">
            <legend className="mb-2 text-sm font-medium text-fg">Mode</legend>
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
                  <span className="t flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-bg text-sm text-muted hover:border-fg/20 hover:text-fg peer-checked:border-accent peer-checked:bg-accent/5 peer-checked:font-medium peer-checked:text-fg peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                    <Icon className="size-4" aria-hidden /> {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset role="radiogroup" aria-label="Color scheme">
            <legend className="mb-2 text-sm font-medium text-fg">Color scheme</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                    <span className="t flex h-12 items-center gap-3 rounded-lg border border-border bg-bg px-3 text-left text-sm hover:border-fg/20 peer-checked:border-accent peer-checked:bg-accent/5 peer-checked:font-medium peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border"
                        style={{ backgroundColor: info.bg[resolved] }}
                      >
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ backgroundColor: info.accent[resolved] }}
                        >
                          {selected && (
                            <Check size={12} color={info.bg[resolved]} strokeWidth={3} />
                          )}
                        </span>
                      </span>
                      <span>{info.label}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="mt-2.5 text-xs text-muted">
              Saved on this device. Each scheme has a light and a dark version.
            </p>
          </fieldset>
        </div>
      </Section>
      <Section
        title="Notifications"
        description="Get a desktop notification when a teammate files a bug while Squash is in the background."
        footer={
          supported && (
            <Button
              size="sm"
              aria-pressed={enabled}
              disabled={requesting || permission === 'denied'}
              onClick={async () => {
                setRequesting(true)
                try {
                  await setEnabled(!enabled)
                } finally {
                  setRequesting(false)
                }
              }}
            >
              {requesting
                ? 'Requesting permission…'
                : enabled
                  ? 'Disable notifications'
                  : 'Enable notifications'}
            </Button>
          )
        }
      >
        {!supported ? (
          <p className="text-sm text-muted">
            Desktop notifications are not supported in this browser.
          </p>
        ) : permission === 'denied' ? (
          <p className="text-sm text-muted">
            Notifications are blocked. Allow notifications for Squash in your browser settings to
            re-enable them.
          </p>
        ) : (
          <p className="text-sm text-muted">
            {enabled
              ? 'Notifications are on for this device.'
              : 'Notifications are off for this device.'}
          </p>
        )}
      </Section>
    </div>
  )
}
