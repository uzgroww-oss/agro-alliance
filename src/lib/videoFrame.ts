/**
 * Videodan kadr olish.
 *
 * NEGA KERAK: butun videoni AI'ga yuborish juda qimmat. Gemini videoni
 * kadrlarga ajratib o'qiydi va 30 soniyalik video minglab token yeydi —
 * bepul tarif chegarasi birinchi so'rovdayoq to'lib qoladi.
 *
 * Post matni uchun videoning MAZMUNI kerak, har bir kadri emas. Bitta
 * yaxshi kadr yetadi va u oddiy rasm sifatida ketadi. Qo'shimcha foyda:
 * shu tarzda rasmni ko'ra oladigan HAR QANDAY model ishlaydi, faqat
 * video qo'llab-quvvatlaydigani emas.
 */

const MAX_SIDE = 1024

/**
 * Videoning berilgan soniyasidan kadr oladi va base64 JPEG qaytaradi
 * (prefikssiz — AI API'lari shuni kutadi).
 *
 * Kadr boshidan emas, biroz ichkaridan olinadi: ko'p videolarning
 * birinchi kadri qora yoki bo'sh bo'ladi.
 */
export function extractVideoFrame(
  src: string,
  atSeconds = 1.5,
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    let done = false
    const fail = (why: string) => {
      if (done) return
      done = true
      video.removeAttribute("src")
      reject(new Error(why))
    }

    // Video yuklanmay qolsa cheksiz kutib turmasin
    const timer = setTimeout(() => fail("Videoni o'qib bo'lmadi"), 20_000)

    video.onerror = () => { clearTimeout(timer); fail("Videoni ochib bo'lmadi") }

    video.onloadedmetadata = () => {
      // Video juda qisqa bo'lsa o'rtasidan olamiz
      const t = video.duration && video.duration > atSeconds ? atSeconds : (video.duration || 0) / 2
      video.currentTime = Math.max(0, t)
    }

    video.onseeked = () => {
      if (done) return
      clearTimeout(timer)
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return fail("Video o'lchami noma'lum")

        const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) return fail("Kadrni chizib bo'lmadi")
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // toDataURL "data:image/jpeg;base64,..." qaytaradi — API'lar
        // faqat vergulingdan keyingi qismni kutadi.
        const url = canvas.toDataURL("image/jpeg", 0.85)
        const comma = url.indexOf(",")
        if (comma === -1) return fail("Kadrni o'qib bo'lmadi")

        done = true
        video.removeAttribute("src")
        resolve({ data: url.slice(comma + 1), mimeType: "image/jpeg" })
      } catch {
        // Boshqa domendagi video canvas'ni "iflos" qiladi va o'qib
        // bo'lmaydi. Storage CORS bersa bu bo'lmaydi.
        fail("Kadrni olishga ruxsat yo'q")
      }
    }

    video.src = src
  })
}
