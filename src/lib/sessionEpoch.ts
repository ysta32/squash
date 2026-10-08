/**
 * A counter that moves whenever the signed-in user changes (sign-in, sign-out, account switch).
 * Module-level state that queues writes for "the current user" (settings autosave) records the
 * epoch it was created in and drops anything from an earlier one, so nothing queued by one
 * session runs under the next.
 */
let epoch = 0

export function sessionEpoch(): number {
  return epoch
}

export function bumpSessionEpoch(): void {
  epoch += 1
}
