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
        reject(new Error("Yuklashda xatolik"))
      }
    }

    xhr.onerror = () => reject(new Error("Tarmoq xatoligi"))
    xhr.send(file)
  })
}
