import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import App from './App.jsx'
import { SkyProvider } from './campus/useSky.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SkyProvider>
      <App />
    </SkyProvider>
  </StrictMode>,
)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}