import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ConfigError } from './components/ConfigError'
import { missingConfig } from './lib/config'
import { applyStoredTheme } from './lib/theme'

applyStoredTheme()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}
const root = createRoot(rootElement)

const missing = missingConfig(import.meta.env)
if (missing.length > 0) {
  // Without Supabase settings the client module throws on import, so never load the app.
  root.render(<ConfigError missing={missing} />)
} else {
  void import('./App').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
