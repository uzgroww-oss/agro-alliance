import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initNative } from './lib/native'
import { lugatniTayyorla } from './lib/i18n'
import { currentLang } from './lib/lang'

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

/**
 * LUG'AT ILOVADAN OLDIN YUKLANADI.
 *
 * NEGA AYNAN SHU YERDA: `tr()` sinxron ishlaydi va uni komponent
 * tashqarisida — massiv e'lonida, modul darajasida — ham chaqirish
 * mumkin. Agar lug'at React ishga tushgandan KEYIN kelsa, o'sha
 * joylarda o'zbekcha matn qotib qolardi va til almashtirilgandek
 * ko'rinmasdi.
 *
 * React umuman boshlanmasdan turib yuklash bu butun muammoni
 * yo'q qiladi: ilova ishga tushganda lug'at ALLAQACHON joyida.
 *
 * NARXI: o'zbek tilida kirgan foydalanuvchi uchun NOL — unga lug'at
 * kerak emas va `lugatniTayyorla` darhol qaytadi. Boshqa tildagilar
 * bir marta kichik fayl kutadi, buning evaziga esa hamma 81 KB
 * o'rniga faqat o'z tilini yuklaydi.
 *
 * Yuklash yiqilsa ham ilova ishga tushadi — `lugatniTayyorla` xato
 * otmaydi, eng yomon holatda matn o'zbekcha qoladi.
 */
void lugatniTayyorla(currentLang()).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
