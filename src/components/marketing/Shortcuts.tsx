import { Kbd } from '../ui'
import { facts } from './facts'
import { keyLabel } from './keyLabel'

/** Every app shortcut as a two-column table, read from the app's shortcut sheet at build time. */
export function ShortcutTable({ className }: { className?: string }) {
  return (
    <div className={className}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Keyboard shortcuts</caption>
        <thead>
          <tr className="specimen-label text-ink-3">
            <th scope="col" className="w-40 py-2 pr-6 font-normal">
              Keys
            </th>
            <th scope="col" className="py-2 font-normal">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {facts.shortcuts.map((shortcut) => (
            <tr key={shortcut.label} className="border-t border-line">
              <td className="py-2.5 pr-6 align-top whitespace-nowrap">
                <span className="inline-flex gap-1">
                  {shortcut.keys.map((key, i) => (
                    <Kbd key={i}>{keyLabel(key)}</Kbd>
                  ))}
                </span>
              </td>
              <td className="py-2.5 text-base text-ink-2">{shortcut.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
