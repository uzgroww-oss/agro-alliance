/**
 * Rasmni ijtimoiy tarmoq talab qiladigan o'lchamga keltirish.
 *
 * NEGA KERAK: Instagram feed rasmini faqat 4:5 (0.8) dan 1.91:1 gacha
 * qabul qiladi. Bundan keng yoki tor rasm "The aspect ratio is not
 * supported" bilan rad etiladi. Foydalanuvchi har safar rasmni qo'lda
 * qirqishi kerak bo'lmasin.
 *
 * QIRQMAYMIZ, KENGAYTIRAMIZ. Kesish rasmning chetidagi matn yoki logoni
 * yo'q qilib yuborishi mumkin — banner rasmlarda aynan shunday bo'ladi.
 * Buning o'rniga rasm eng yaqin RUXSAT ETILGAN nisbatgacha fon bilan
 * to'ldiriladi. Rasmning o'zi butun qoladi.
 *
 * Nisbat allaqachon oralig'ida bo'lsa fayl UMUMAN o'zgartirilmaydi —
 * ortiqcha qayta siqish sifatni pasaytiradi.
 */

export const IG_MIN_RATIO = 0.8 // 4:5 — tik
export const IG_MAX_RATIO = 1.91 // 1.91:1 — yotiq

/** Instagram uchun eng katta tomon. Bundan kattasi keraksiz og'irlik. */
const MAX_SIDE = 1440

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Rasmni o'qib bo'lmadi"))
    }
    img.src = url
  })
}

/**
 * Fon rangi — rasmning burchaklaridan olinadi.
 * Oq fonli rasmga oq, qora fonliga qora chegara qo'shiladi, shunda
 * to'ldirilgani deyarli bilinmaydi.
 */
function edgeColor(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  try {
    const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
    let r = 0, g = 0, b = 0
    for (const [x, y] of pts) {
      const d = ctx.getImageData(x, y, 1, 1).data
      r += d[0]; g += d[1]; b += d[2]
    }
    return `rgb(${Math.round(r / 4)}, ${Math.round(g / 4)}, ${Math.round(b / 4)})`
  } catch {
    // getImageData tashqi manbali rasmda xato berishi mumkin
    return "#ffffff"
  }
}

/**
 * Faylni Instagram qabul qiladigan nisbatga keltiradi.
 * O'zgartirish kerak bo'lmasa asl faylni qaytaradi.
 */
export async function fitForInstagram(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  // GIF animatsiyasi canvas orqali o'tsa birinchi kadrga aylanadi —
  // tegmaganimiz ma'qul.
  if (file.type === "image/gif") return file

  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    return file // o'qib bo'lmasa aralashmaymiz, server o'zi xato beradi
  }

  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return file

  const ratio = w / h
  const tooWide = ratio > IG_MAX_RATIO
  const tooTall = ratio < IG_MIN_RATIO
  const tooBig = Math.max(w, h) > MAX_SIDE

  if (!tooWide && !tooTall && !tooBig) return file

  // Maqsad nisbat: eng yaqin ruxsat etilgani. Shunda qo'shiladigan
  // chegara eng kichik bo'ladi.
  const targetRatio = tooWide ? IG_MAX_RATIO : tooTall ? IG_MIN_RATIO : ratio

  // Kanvas o'lchami: rasm to'liq sig'sin
  let cw = tooTall ? Math.round(h * targetRatio) : w
  let ch = tooWide ? Math.round(w / targetRatio) : h
  if (cw < w) cw = w
  if (ch < h) ch = h

  // Kerak bo'lsa kichraytiramiz
  const scale = Math.min(1, MAX_SIDE / Math.max(cw, ch))
  const outW = Math.round(cw * scale)
  const outH = Math.round(ch * scale)
  const drawW = Math.round(w * scale)
  const drawH = Math.round(h * scale)

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) return file

  // Fon rangini kichraytirilgan nusxadan olamiz — katta rasmni to'liq
  // kanvasga chizib pixel o'qish keraksiz og'ir.
  const tmp = document.createElement("canvas")
  tmp.width = 8
  tmp.height = 8
  const tctx = tmp.getContext("2d")
  let bg = "#ffffff"
  if (tctx) {
    tctx.drawImage(img, 0, 0, 8, 8)
    bg = edgeColor(tctx, 8, 8)
  }

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, outW, outH)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, Math.round((outW - drawW) / 2), Math.round((outH - drawH) / 2), drawW, drawH)

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92))
  if (!blob) return file

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() })
}
