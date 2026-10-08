import { useSyncExternalStore } from 'react'

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getOnline(): boolean {
  return navigator.onLine
}

function getServerOnline(): boolean {
  return true
}

/** Whether the browser reports a network connection (live: follows online / offline events). */
export function useBrowserOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline, getServerOnline)
}
