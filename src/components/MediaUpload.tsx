import { useState, useRef } from "react"
import { Icon, I } from "../lib/ui"
import { api } from "../lib/api"

type UploadResult = { fileId: string; signedUrl: string; storageKey: string; publicUrl?: string }

type UploadProgress = {
  current: number
  total: number
  fileName: string
  percent: number
}

type UploadItem = {
  id: string
  fileName: string
  status: "uploading" | "done" | "error"
  error?: string
  result?: UploadResult
}

export default function MediaUpload({
  onUpload,
  accept = "image/*",
  multiple = false,
}: {
  onUpload?: (result: UploadResult) => void
  accept?: string
  multiple?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [uploaded, setUploaded] = useState<UploadResult | null>(null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadSingleFile = async (file: File): Promise<UploadResult> => {
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
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setProgress((prev) =>
            prev ? { ...prev, percent } : null,
          )
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ...result, signedUrl: result.publicUrl || result.signedUrl })
        } else {
          reject(new Error("Yuklashda xatolik"))
        }
      }

      xhr.onerror = () => reject(new Error("Tarmoq xatoligi"))
      xhr.send(file)
    })
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError("")
    setUploaded(null)

    const fileList = Array.from(files)
    const initialItems: UploadItem[] = fileList.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      status: "uploading" as const,
    }))
    setItems(initialItems)
    setUploading(true)

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setProgress({
        current: i + 1,
        total: fileList.length,
        fileName: file.name,
        percent: 0,
      })

      try {
        const result = await uploadSingleFile(file)
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "done" as const, result }
              : item,
          ),
        )
        onUpload?.(result)
        if (fileList.length === 1) {
          setUploaded(result)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Yuklashda xatolik"
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error" as const, error: msg } : item,
          ),
        )
        if (fileList.length === 1) setError(msg)
      }
    }

    setUploading(false)
    setProgress(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const doneCount = items.filter((i) => i.status === "done").length
  const failCount = items.filter((i) => i.status === "error").length

  return (
    <div>
      <input ref={fileRef} type="file" accept={accept} multiple={multiple} onChange={handleFiles} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-green/30 bg-soft px-5 py-3 text-sm font-semibold text-green transition-colors hover:border-green hover:bg-green/5 disabled:opacity-60"
      >
        {uploading ? (
          <><Icon d={I.refresh} className="h-4 w-4 animate-spin" /> Yuklanmoqda…</>
        ) : (
          <><Icon d={I.upload} className="h-4 w-4" /> {multiple ? "Fayllarni yuklash" : "Fayl yuklash"}</>
        )}
      </button>

      {progress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{progress.current}/{progress.total} — {progress.fileName}</span>
            <span className="font-semibold text-green">{progress.percent}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-green/10">
            <div
              className="h-full rounded-full bg-green transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {items.length > 0 && !progress && (
        <div className="mt-3 space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                item.status === "done"
                  ? "bg-green/10 text-green"
                  : item.status === "error"
                    ? "bg-red-50 text-red-600"
                    : "bg-soft text-muted"
              }`}
            >
              {item.status === "done" ? (
                <Icon d={I.check} className="h-4 w-4 shrink-0" />
              ) : item.status === "error" ? (
                <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-4 w-4 shrink-0" />
              ) : (
                <Icon d={I.refresh} className="h-4 w-4 shrink-0 animate-spin" />
              )}
              <span className="flex-1 truncate">{item.fileName}</span>
              {item.status === "done" && <span className="text-xs font-semibold">✓ Yuklandi</span>}
              {item.status === "error" && <span className="text-xs">{item.error}</span>}
            </div>
          ))}
          <p className="text-xs font-medium text-green">
            {doneCount} ta fayl yuklandi
            {failCount > 0 && <span className="text-red-600">, {failCount} tasida xatolik</span>}
          </p>
        </div>
      )}

      {uploaded && items.length === 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
          <Icon d={I.check} className="h-4 w-4" /> Yuklandi
        </div>
      )}

      {error && !progress && items.length === 0 && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
