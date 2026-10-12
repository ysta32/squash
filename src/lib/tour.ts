/** Set once the tour has been finished or closed, so it opens by itself at most once per browser. */
export const TOUR_SEEN_KEY = 'squash:tour-seen'

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, 'true')
  } catch {
    // The tour still closes when storage is unavailable; it may simply offer itself again.
  }
}
