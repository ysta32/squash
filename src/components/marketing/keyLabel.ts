import { isMac } from '../../lib/utils'
import type { FactKey } from './facts-types'

/** A shortcut key as this visitor's keyboard prints it (⌘/Ctrl, ⌥/Alt). */
export function keyLabel(key: FactKey): string {
  if (key.kind === 'mod') return isMac ? '⌘' : 'Ctrl'
  if (key.kind === 'alt') return isMac ? '⌥' : 'Alt'
  return key.label
}
