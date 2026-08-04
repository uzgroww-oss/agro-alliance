import { useEffect, useState } from "react"

/**
 * OAUTH ROZILIGIDAN KEYINGI KICHIK SAHIFA.
 *
 * NEGA ALOHIDA SAHIFA: Google roziligi KICHIK QALQIB CHIQQAN OYNADA
 * ochiladi va tugagach o'sha oynaga qaytariladi. Ilgari u `/admin` ga
 * qaytarilardi — natijada 400px lik oynachada butun admin paneli
 * yuklanib, ichida "Topshiriqlar" bo'limi chiqib turardi. Foydalanuvchi
 * ulanish tugaganini ham tushunmasdi.
 *
 * Endi shu yerga qaytariladi: natija bir qatorda aytiladi va oyna
 * O'ZINI YOPADI. Asosiy panel esa fonda holatni o'zi yangilaydi.
 *
 * HTML ni to'g'ridan-to'g'ri edge funksiyadan qaytarib bo'lmaydi:
 * Supabase *.supabase.co domenida uni majburan text/plain ga
 * aylantiradi (fishingga qarshi himoya) va script ishlamaydi.
 */
export default function OauthYakun() {
  const p = new URLSearchParams(window.location.search)
  const xato = p.get("xato") || ""
  const kanal = p.get("kanal") || ""
  const ok = !xato

  // Oyna yopilmasa (masalan foydalanuvchi uni o'zi ochgan bo'lsa)
  // xabar ekranda qolsin
  const [yopilmadi, setYopilmadi] = useState(false)

  /**
   * FAQAT MUVAFFAQIYATDA yopamiz.
   *
   * Xatoda oyna o'zi yopilib ketsa, foydalanuvchi sababni o'qib
   * ulgurmaydi va nima bo'lganini bilmay qoladi — aynan shu paytda
   * sabab eng kerak.
   */
  useEffect(() => {
    if (!ok) return
    const t = setTimeout(() => {
      try { window.close() } catch { /* yopishga ruxsat yo'q */ }
      setYopilmadi(true)
    }, 1200)
    return () => clearTimeout(t)
  }, [ok])

  return (
    <div className="grid min-h-screen place-items-center bg-[#fafdf7] px-6 text-center">
      <div>
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${ok ? "bg-green/10" : "bg-red-50"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`h-8 w-8 ${ok ? "text-green" : "text-red-500"}`}>
            {ok ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18 M6 6l12 12" />}
          </svg>
        </span>

        <h1 className="mt-4 font-display text-xl font-extrabold">
          {ok ? "Ulandi" : "Ulanmadi"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {ok
            ? (kanal ? `YouTube kanali: ${kanal}` : "YouTube kanali ulandi")
            : xato}
        </p>

        <p className="mt-4 text-xs text-muted">
          {!ok || yopilmadi ? "Bu oynani yopishingiz mumkin." : "Oyna yopilmoqda..."}
        </p>
      </div>
    </div>
  )
}
