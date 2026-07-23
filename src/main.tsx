import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initNative } from './lib/native'

// Native ilova sozlamalari (status bar, splash) — web'da hech narsa qilmaydi
void initNative()

/**
 * Instagram OAuth popup'ini yopish.
 *
 * Bu ROUTER'DAN OLDIN turishi shart: popup /admin ga qaytadi, lekin u
 * yerda autentifikatsiya tekshiruvi bo'lib, foydalanuvchi /kirish ga
 * otib yuborilishi mumkin — u holda yopish kodi umuman ishlamas edi.
 */
{
  const sp = new URLSearchParams(window.location.search)
  const res = sp.get("instagram")
  if (res && window.opener) {
    window.opener.postMessage(
      { type: res === "ok" ? "instagram-connected" : "instagram-error", username: sp.get("username") || "", xato: sp.get("xato") || "" },
      window.location.origin,
    )
    window.close()
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
