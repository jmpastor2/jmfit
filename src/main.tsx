import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { App } from '@/app/App'

// After an update the old hashed chunks are gone: a lazy screen still pointing at one fails to
// load. Reloading picks up the new files instead of leaving a blank screen.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
