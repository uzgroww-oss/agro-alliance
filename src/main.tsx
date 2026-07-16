import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initNative } from './lib/native'

// Native ilova sozlamalari (status bar, splash) — web'da hech narsa qilmaydi
void initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
