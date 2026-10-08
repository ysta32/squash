/**
 * Invite codes as the database makes them (gen_invite_code in 0001_init.sql): 8 characters from
 * A-Z and 2-9 without the look-alikes I, O, 0 and 1.
 */
export const INVITE_CODE = /^[A-HJ-NP-Z2-9]{8}$/
export const INVITE_LENGTH = 8

/**
 * What someone pastes into "Have an invite?": a full invite link (`…/join/K3X9LMNP`) or the code
 * itself, in any case, with stray spaces or a dash. Returns the code as the server stores it.
 */
export function parseInviteInput(raw: string): string {
  const link = raw.match(/\/join\/([^/?#\s]+)/i)
  let code = raw
  if (link) {
    try {
      code = decodeURIComponent(link[1])
    } catch {
      code = link[1]
    }
  }
  return code.toUpperCase().replace(/[\s-]/g, '')
}
