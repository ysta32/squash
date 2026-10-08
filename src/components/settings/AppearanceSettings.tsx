import { Monitor, Moon, Sun } from 'lucide-react'
import { COLOR_SCHEMES, SCHEME_INFO, useColorScheme, useTheme, type Theme } from '../../lib/theme'
import { cn } from '../../lib/utils'
import { LedgerGroup, LedgerRow, SaveIndicator, SettingsPanel } from './Ledger'
import { useAutosave } from './useAutosave'

const MODES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const ICON = { strokeWidth: 1.5, absoluteStrokeWidth: true, className: 'size-4' } as const

export function AppearanceSettings() {
  const { theme, resolved, setTheme } = useTheme()
  const { scheme, setScheme } = useColorScheme()

  // Saved to this device at once; the tick just confirms it, like the profile fields.
  const modeSave = useAutosave('appearance:theme', theme, 'Could not save the mode.')
  const schemeSave = useAutosave('appearance:scheme', scheme, 'Could not save the accent.')

  return (
    <SettingsPanel
      id="appearance"
      title="Appearance"
      description="Paper or darkroom, and the ink used for accents. Saved on this device as you choose."
    >
      <LedgerGroup>
        <LedgerRow
          label="Mode"
          description="System follows your operating system."
          status={<SaveIndicator state={modeSave.state} />}
        >
          <fieldset
            role="radiogroup"
            aria-label="Mode"
            className="grid w-full grid-cols-3 rounded-md border border-line-2 bg-surface-1 p-0.5 sm:w-auto"
          >
            {MODES.map(({ value, label, icon: Icon }) => (
              <label key={value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => {
                    // Applied and stored at once; the queue only drives the "Saved" tick.
                    setTheme(value)
                    void modeSave.commit(value, async () => {})
                  }}
                  className="peer sr-only"
                />
                <span className="t flex h-8 items-center justify-center gap-1.5 rounded-sm px-3 text-sm text-ink-2 peer-checked:bg-surface-2 peer-checked:font-medium peer-checked:text-ink peer-checked:shadow-elev-1 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus hover:text-ink max-sm:h-[2.8571rem]">
                  <Icon {...ICON} aria-hidden /> {label}
                </span>
              </label>
            ))}
          </fieldset>
        </LedgerRow>
        <LedgerRow
          stack
          label="Accent ink"
          description="Changes links, focus rings, the selected row and primary buttons. Neutrals stay the same."
          status={<SaveIndicator state={schemeSave.state} />}
        >
          <fieldset
            role="radiogroup"
            aria-label="Color scheme"
            className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5"
          >
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
                      void schemeSave.commit(value, async () => {})
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      't flex h-[3.1429rem] items-center gap-2.5 rounded-md border px-3 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                      selected
                        ? 'border-ink bg-surface-2 font-medium text-ink'
                        : 'border-line-2 text-ink-2 hover:border-line-input hover:text-ink',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full"
                      style={{ backgroundColor: info.accent[resolved] }}
                    />
                    {info.label}
                  </span>
                </label>
              )
            })}
          </fieldset>
        </LedgerRow>
      </LedgerGroup>
    </SettingsPanel>
  )
}
