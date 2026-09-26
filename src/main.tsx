import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { initStorage } from './lib/storage'

// Listings live in IndexedDB; load them before the first render so every
// screen can read them synchronously.
initStorage().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
