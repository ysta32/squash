/** The one definition of a character allowed in an @mention handle. */
export const MENTION_CHAR = /[\p{L}\p{N}_.-]/u

/** Display name reduced to the characters the mention highlighter accepts. */
export function mentionHandle(name: string): string {
  return Array.from(name)
    .filter((c) => MENTION_CHAR.test(c))
    .join('')
}
