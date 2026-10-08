import { useState } from 'react'
import { Button } from '../ui'
import { useNotifications } from '../../hooks/useNotifications'
import { LedgerGroup, LedgerRow, SettingsPanel, TOUCH } from './Ledger'

export function NotificationSettings() {
  const { supported, permission, enabled, setEnabled } = useNotifications()
  const [requesting, setRequesting] = useState(false)

  const state = !supported
    ? 'Not supported in this browser.'
    : permission === 'denied'
      ? 'Blocked. Allow notifications for Squash in your browser settings to turn them on.'
      : enabled
        ? 'On for this device.'
        : 'Off for this device.'

  return (
    <SettingsPanel
      id="notifications"
      title="Notifications"
      description="Squash only notifies you while it is open in the background. Nothing is emailed."
    >
      <LedgerGroup>
        <LedgerRow
          label="Desktop notifications"
          description={
            <>
              A notification when a teammate files a bug.{' '}
              <span role="status" className="text-ink">
                {state}
              </span>
            </>
          }
        >
          {supported && (
            <Button
              aria-pressed={enabled}
              variant={enabled ? 'secondary' : 'primary'}
              className={TOUCH}
              disabled={requesting || permission === 'denied'}
              onClick={async () => {
                setRequesting(true)
                try {
                  await setEnabled(!enabled)
                } finally {
                  setRequesting(false)
                }
              }}
            >
              {requesting ? 'Requesting permission…' : enabled ? 'Turn off' : 'Turn on'}
            </Button>
          )}
        </LedgerRow>
      </LedgerGroup>
    </SettingsPanel>
  )
}
