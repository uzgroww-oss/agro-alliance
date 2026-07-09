import { useState, useRef } from "react"
import { Icon, I } from "../lib/ui"
import { api } from "../lib/api"

type UploadResult = { fileId: string; signedUrl: string; storageKey: string }

export default function MediaUpload({ onUpload, accept = "image/*" }: { onUpload?: (result: UploadResult) => void; accept?: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [uploaded, setUploaded] = useState<UploadResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError("")
    setUploaded(null)

    try {
      // Get signed upload URL
      const { fileId, signedUrl, storageKey } = await api<{ fileId: string; signedUrl: string; storageKey: string }>(
        "/media-get-signed-upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            originalFilename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            isPublic: true,
          }),
        }
      )

      // Upload to R2
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      if (!uploadRes.ok) throw new Error("Upload failed")

      const result = { fileId, signedUrl: signedUrl.split("?")[0], storageKey }
      setUploaded(result)
      onUpload?.(result)
    } catch (err: any) {
      setError(err?.message || "Yuklashda xatolik")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-green/30 bg-soft px-5 py-3 text-sm font-semibold text-green transition-colors hover:border-green hover:bg-green/5 disabled:opacity-60"
      >
        {uploading ? (
          <><Icon d={I.refresh} className="h-4 w-4 animate-spin" /> Yuklanmoqda…</>
        ) : (
          <><Icon d={I.upload} className="h-4 w-4" /> Fayl yuklash</>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {uploaded && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
          <Icon d={I.check} className="h-4 w-4" /> Yuklandi
        </div>
      )}
    </div>
  )
}
