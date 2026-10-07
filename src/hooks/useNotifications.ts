import { useSyncExternalStore } from 'react'

const KEY = 'squash:notifications'
const listeners = new Set<() => void>()
let unstoredEnabled: boolean | null = null
let requestId = 0

function getPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'function' && typeof Notification.requestPermission === 'function'
    ? Notification.permission
    : 'unsupported'
}

function getEnabled(): boolean {
  if (unstoredEnabled !== null) return unstoredEnabled
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return
    unstoredEnabled = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', listener)
  document.addEventListener('visibilitychange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', listener)
    document.removeEventListener('visibilitychange', listener)
  }
}

async function setEnabled(on: boolean): Promise<void> {
  const id = ++requestId
  let enabled = false
  if (on && getPermission() !== 'unsupported') {
    try {
      const permission =
        getPermission() === 'default' ? await Notification.requestPermission() : getPermission()
      enabled = permission === 'granted'
    } catch {
      enabled = false
    }
  }
  if (id !== requestId) return
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
    unstoredEnabled = null
  } catch {
    unstoredEnabled = enabled
  }
  emit()
}

type NotificationOptions = {
  title: string
  body: string
  tag: string
  onClick?: () => void
}

function notify({ title, body, tag, onClick }: NotificationOptions): void {
  if (
    !getEnabled() ||
    getPermission() !== 'granted' ||
    typeof document === 'undefined' ||
    document.visibilityState === 'visible'
  ) {
    return
  }
  let notification: Notification
  try {
    notification = new Notification(title, { body, tag })
  } catch {
    // Some mobile browsers expose Notification but do not support its constructor.
    return
  }
  notification.onclick = () => {
    window.focus()
    notification.close()
    onClick?.()
  }
}

export function useNotifications(): {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  enabled: boolean
  setEnabled(on: boolean): Promise<void>
  notify(opts: NotificationOptions): void
} {
  const permission = useSyncExternalStore(subscribe, getPermission, () => 'unsupported' as const)
  const preference = useSyncExternalStore(subscribe, getEnabled, () => false)
  return {
    supported: permission !== 'unsupported',
    permission,
    enabled: preference && permission === 'granted',
    setEnabled,
    notify,
  }
}
