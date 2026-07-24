/**
 * Video uchun muqova (prevyu) yasash.
 *
 * NEGA AI RASM CHIZMAYDI: YouTube prevyusi yoki Instagram muqovasi
 * videoning O'ZINI ko'rsatishi kerak. AI o'ylab topgan rasm chiroyli
 * bo'lsa ham videoga aloqasi bo'lmaydi va odam bosганda aldangandek
 * his qiladi. Shuning uchun muqova videoning haqiqiy kadridan yasaladi,
 * ustiga sarlavha yoziladi — YouTube'dagi prevyular aynan shunday.
 */

export type ThumbSize = { key: string; label: string; w: number; h: number }

export const THUMB_SIZES: ThumbSize[] = [
  { key: "youtube", label: "YouTube (16:9)", w: 1280, h: 720 },
  { key: "instagram", label: "Instagram (4:5)", w: 1080, h: 1350 },
  { key: "square", label: "Kvadrat (1:1)", w: 1080, h: 1080 },
]

/** Videodan bir nechta kadr olish — foydalanuvchi eng yaxshisini tanlasin */
export function extractFrames(src: string, count = 4): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    const frames: string[] = []
    let times: number[] = []
    let idx = 0
    let done = false

    const fail = (why: string) => {
      if (done) return
      done = true
      video.removeAttribute("src")
      reject(new Error(why))
    }
    const timer = setTimeout(() => fail("Videoni o'qib bo'lmadi"), 30_000)

    video.onerror = () => { clearTimeout(timer); fail("Videoni ochib bo'lmadi") }

    video.onloadedmetadata = () => {
      const dur = video.duration || 0
      if (!dur || !isFinite(dur)) return fail("Video uzunligi noma'lum")
      // Boshi va oxirini chetlab o'tamiz: ular ko'pincha qora yoki
      // titrlar bo'ladi.
      times = Array.from({ length: count }, (_, i) => dur * (0.15 + (0.6 * i) / Math.max(1, count - 1)))
      video.currentTime = times[0]
    }

    video.onseeked = () => {
      if (done) return
      try {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return fail("Kadrni chizib bo'lmadi")
        ctx.drawImage(video, 0, 0)
        frames.push(canvas.toDataURL("image/jpeg", 0.9))
      } catch {
        return fail("Kadrni olishga ruxsat yo'q")
      }

      idx++
      if (idx < times.length) {
        video.currentTime = times[idx]
      } else {
        clearTimeout(timer)
        done = true
        video.removeAttribute("src")
        resolve(frames)
      }
    }

    video.src = src
  })
}

/** Matnni berilgan kenglikka sig'adigan qatorlarga bo'lish */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Kadr + sarlavhadan muqova yasaydi.
 *
 * Kadr "cover" tarzida joylanadi (cho'zilmaydi, kesiladi), pastiga
 * qorayuvchi gradient qo'yiladi va sarlavha oq harflar bilan yoziladi —
 * har qanday rasmda o'qilishi uchun.
 */
export function composeThumbnail(
  frameDataUrl: string,
  title: string,
  size: ThumbSize,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = size.w
      canvas.height = size.h
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("Kanvas ochilmadi"))

      // cover: rasm butun maydonni qoplasin, nisbati buzilmasin
      const scale = Math.max(size.w / img.width, size.h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, (size.w - dw) / 2, (size.h - dh) / 2, dw, dh)

      const text = (title || "").trim()
      if (text) {
        const pad = Math.round(size.w * 0.06)
        const fontSize = Math.round(size.w * (size.key === "youtube" ? 0.072 : 0.065))
        ctx.font = `800 ${fontSize}px system-ui, "Segoe UI", sans-serif`
        ctx.textBaseline = "bottom"

        const lines = wrapText(ctx, text, size.w - pad * 2).slice(0, 3)
        const lineH = Math.round(fontSize * 1.18)
        const blockH = lines.length * lineH

        // Pastdan yuqoriga qorayuvchi gradient — matn har qanday
        // fon ustida o'qiladi
        const gradTop = size.h - blockH - pad * 2.2
        const grad = ctx.createLinearGradient(0, gradTop, 0, size.h)
        grad.addColorStop(0, "rgba(0,0,0,0)")
        grad.addColorStop(1, "rgba(0,0,0,0.82)")
        ctx.fillStyle = grad
        ctx.fillRect(0, gradTop, size.w, size.h - gradTop)

        // Yashil urg'u chizig'i
        ctx.fillStyle = "#5BB420"
        ctx.fillRect(pad, size.h - pad - blockH - Math.round(fontSize * 0.5), Math.round(size.w * 0.09), Math.round(fontSize * 0.12))

        ctx.fillStyle = "#ffffff"
        ctx.shadowColor = "rgba(0,0,0,0.55)"
        ctx.shadowBlur = Math.round(fontSize * 0.25)
        lines.forEach((l, i) => {
          ctx.fillText(l, pad, size.h - pad - (lines.length - 1 - i) * lineH)
        })
        ctx.shadowBlur = 0
      }

      resolve(canvas.toDataURL("image/jpeg", 0.9))
    }
    img.onerror = () => reject(new Error("Kadrni o'qib bo'lmadi"))
    img.src = frameDataUrl
  })
}

/** data URL ni yuklash uchun File ga aylantirish */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(",")
  const bin = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: "image/jpeg" })
}
