import { api } from "./api"

/**
 * Fayl yuklash — MediaUpload komponentidan ajratildi.
 *
 * NEGA AJRATILDI: rasmni komponentsiz ham yuklash kerak bo'ladi.
 * Masalan eski postni tahrirlaganda uning rasmi Instagram o'lchamiga
 * mos kelmasa, uni jimgina to'g'irlab qayta yuklaymiz.
 */

export type UploadResult = {
  fileId: string
  signedUrl: string
  storageKey: string
  publicUrl?: string
  fileName?: string
}

export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const result = await api<UploadResult>("/media-get-signed-upload-url", {
    method: "POST",
    body: JSON.stringify({
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      isPublic: true,
    }),
  })

  return await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", result.signedUrl, true)
    xhr.setRequestHeader("Content-Type", file.type)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ...result, signedUrl: result.publicUrl || result.signedUrl, fileName: file.name })
      } else {
        // Storage javobidagi HAQIQIY sababni ko'rsatamiz. Ilgari
        // "Yuklashda xatolik" deb yutib yuborilardi va bucket cheklovi
        // (mime turi, hajm) nima ekanini bilib bo'lmasdi.
        let why = ""
        try {
          const body = JSON.parse(xhr.responseText || "{}")
          why = body.message || body.error || ""
        } catch {
          // Storage HTML xato sahifasi qaytarishi mumkin — undan
          // faqat sarlavhani olamiz, butun HTML ekranni to'ldiradi
          const raw = xhr.responseText || ""
          const title = raw.match(/<title>([^<]+)<\/title>/i)
          why = title ? title[1] : raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)
        }
        // Fayl hajmi va turi — sabab ko'pincha shularda
        const info = `${file.type || "tur noma'lum"}, ${Math.round(file.size / 1024)} KB`
        reject(new Error(`Yuklanmadi (${xhr.status}): ${why || "sabab noma'lum"} · ${info}`))
      }
    }

    xhr.onerror = () => reject(new Error("Tarmoq xatoligi"))
    xhr.send(file)
  })
}
