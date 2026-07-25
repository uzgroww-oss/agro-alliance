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

/** Muqova matni: sarlavha + ixtiyoriy afzallik chiplari */
export type ThumbMeta = { title: string; benefits?: string[] }

/** Yumaloq burchakli to'rtburchak (eski brauzerlar uchun ham) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Brend shabloni bilan professional muqova yasaydi.
 *
 * NEGA SHABLON: FLUX toza yozuv/logotip chizolmaydi (o'zbekchani buzadi,
 * odam qo'shadi). Shuning uchun FON (AI rasm yoki video kadri) + DIZAYN
 * (kod bilan) ajratilgan: logotip, yirik sarlavha, afzallik chiplari —
 * hammasi bir xil brend ko'rinishida, YouTube prevyusiga o'xshash.
 */
export function composeThumbnail(
  frameDataUrl: string,
  meta: string | ThumbMeta,
  size: ThumbSize,
): Promise<string> {
  const title = typeof meta === "string" ? meta : meta.title
  const benefits = (typeof meta === "string" ? [] : meta.benefits || [])
    .map((b) => (b || "").trim()).filter(Boolean).slice(0, 3)

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

      const GREEN = "#8BE04A"
      const pad = Math.round(size.w * 0.05)
      ctx.lineJoin = "round"
      ctx.textBaseline = "bottom"

      // Pastki qism — chiplar joyi (afzalliklar bo'lsa)
      let chipsTop = size.h - pad
      const chipFont = Math.round(size.w * (size.key === "youtube" ? 0.032 : 0.036))
      const chipH = Math.round(chipFont * 2.1)
      if (benefits.length) {
        ctx.font = `800 ${chipFont}px "Segoe UI", system-ui, sans-serif`
        const gap = Math.round(size.w * 0.02)
        const chipPadX = Math.round(chipFont * 0.9)
        // Chiplarni chapdan joylaymiz, kenglikка sig'ganini olamiz
        const drawn: { text: string; w: number }[] = []
        let total = 0
        for (const b of benefits) {
          const w = Math.ceil(ctx.measureText(b.toUpperCase()).width) + chipPadX * 2 + chipH * 0.5
          if (total + w + gap > size.w - pad * 2) break
          drawn.push({ text: b.toUpperCase(), w })
          total += w + gap
        }
        const chipY = size.h - pad - chipH
        chipsTop = chipY
        let x = pad
        for (const c of drawn) {
          ctx.fillStyle = "rgba(20,40,10,0.72)"
          roundRect(ctx, x, chipY, c.w, chipH, chipH / 2)
          ctx.fill()
          // yashil nuqta
          ctx.fillStyle = GREEN
          ctx.beginPath()
          ctx.arc(x + chipPadX + chipH * 0.18, chipY + chipH / 2, chipH * 0.16, 0, Math.PI * 2)
          ctx.fill()
          // matn
          ctx.fillStyle = "#ffffff"
          ctx.textBaseline = "middle"
          ctx.fillText(c.text, x + chipPadX + chipH * 0.5, chipY + chipH / 2 + 1)
          ctx.textBaseline = "bottom"
          x += c.w + gap
        }
      }

      // Sarlavha — yirik, qalin, bosh harfli, oq/yashil galma-gal, kontur
      const text = (title || "").trim().toUpperCase()
      if (text) {
        const maxW = size.w - pad * 2
        // Shriftni MOSLAB olamiz: eng uzun so'z ham kadrga sig'sin.
        // Ilgari uzun so'z ("ISSIQXONASINING") o'ng chetdan toshib
        // ketardi — endi sig'guncha kichraytiramiz.
        let fontSize = Math.round(size.w * (size.key === "youtube" ? 0.098 : 0.086))
        const minSize = Math.round(size.w * 0.045)
        let lines: string[] = []
        for (;;) {
          ctx.font = `900 ${fontSize}px "Arial Black", "Segoe UI", Impact, sans-serif`
          lines = wrapText(ctx, text, maxW).slice(0, 3)
          const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
          if (widest <= maxW || fontSize <= minSize) break
          fontSize = Math.round(fontSize * 0.92)
        }
        const lineH = Math.round(fontSize * 1.06)
        const blockH = lines.length * lineH
        const titleBottom = chipsTop - (benefits.length ? Math.round(pad * 0.5) : 0)

        // Gradient — matn+chiplar hududini qoraytiradi
        const gradTop = titleBottom - blockH - pad * 1.4
        const grad = ctx.createLinearGradient(0, gradTop, 0, size.h)
        grad.addColorStop(0, "rgba(0,0,0,0)")
        grad.addColorStop(1, "rgba(0,0,0,0.8)")
        ctx.fillStyle = grad
        ctx.fillRect(0, gradTop, size.w, size.h - gradTop)

        // Yashil urg'u chizig'i
        ctx.fillStyle = GREEN
        ctx.fillRect(pad, titleBottom - blockH - Math.round(fontSize * 0.42), Math.round(size.w * 0.12), Math.round(fontSize * 0.14))

        const strokeW = Math.max(4, Math.round(fontSize * 0.16))
        lines.forEach((l, i) => {
          const y = titleBottom - (lines.length - 1 - i) * lineH
          ctx.lineWidth = strokeW
          ctx.strokeStyle = "rgba(0,0,0,0.92)"
          ctx.strokeText(l, pad, y)
          ctx.fillStyle = i % 2 === 1 ? GREEN : "#ffffff"
          ctx.fillText(l, pad, y)
        })
      }

      // Brend logotipi — yuqori chapda "AGRO ALLIANCE"
      {
        const lf = Math.round(size.w * 0.030)
        ctx.font = `900 ${lf}px "Segoe UI", system-ui, sans-serif`
        ctx.textBaseline = "top"
        ctx.shadowColor = "rgba(0,0,0,0.6)"
        ctx.shadowBlur = lf * 0.4
        ctx.fillStyle = GREEN
        ctx.fillText("AGRO", pad, pad)
        const aw = ctx.measureText("AGRO ").width
        ctx.fillStyle = "#ffffff"
        ctx.fillText("ALLIANCE", pad + aw, pad)
        ctx.shadowBlur = 0
      }

      resolve(canvas.toDataURL("image/jpeg", 0.92))
    }
    img.onerror = () => reject(new Error("Kadrni o'qib bo'lmadi"))
    img.src = frameDataUrl
  })
}

/**
 * Base64 dan File yasash.
 *
 * AI qaytargan base64 canvas'nikidan farq qiladi: ichida yangi qator
 * bo'lishi, URL-xavfsiz belgilar (- va _) ishlatilishi mumkin. Bunday
 * satrda atob yiqiladi yoki buzuq bayt beradi — natijada Storage
 * "400 Bad Request" qaytaradi va sabab noma'lum bo'ladi.
 *
 * Tur ham BAYTLARDAN aniqlanadi: FLUX PNG qaytarishi mumkin, biz esa
 * uni JPEG deb yozib yuborardik.
 */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(",")
  let b64 = comma > -1 && dataUrl.startsWith("data:") ? dataUrl.slice(comma + 1) : dataUrl

  // Bo'shliq va yangi qatorlarni olib tashlaymiz, URL-xavfsiz
  // belgilarni oddiysiga qaytaramiz
  b64 = b64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/")
  // To'ldiruvchi yetishmasa qo'shamiz
  const pad = b64.length % 4
  if (pad) b64 += "=".repeat(4 - pad)

  let bin: string
  try {
    bin = atob(b64)
  } catch {
    throw new Error("Fayl ma'lumoti buzuq (base64 o'qilmadi)")
  }
  if (!bin.length) throw new Error("Fayl bo'sh keldi")

  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

  // Sehrli baytlar bo'yicha turni aniqlaymiz
  let type = "image/jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50) type = "image/png"
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) type = "image/webp"
  else if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) type = "video/mp4"

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "video/mp4" ? "mp4" : "jpg"
  const finalName = name.replace(/\.[^.]+$/, "") + "." + ext

  return new File([bytes], finalName, { type })
}
