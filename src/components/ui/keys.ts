import { isMac } from '../../lib/utils'

/** Key names for `Kbd` / `Keys`, one cap each. Enter is always the ↵ glyph, on every platform. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'
export const ALT_KEY = isMac ? '⌥' : 'Alt'
export const SHIFT_KEY = isMac ? '⇧' : 'Shift'
export const ENTER_KEY = '↵'
