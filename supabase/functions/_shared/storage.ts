export type StorageProvider = "r2" | "supabase" | "local"

export interface StorageConfig {
  provider: StorageProvider
  bucket: string
  publicUrl: string
}

export interface UploadResult {
  key: string
  url: string
  size: number
  mimeType: string
}

export interface SignedUrlOptions {
  expiresIn: number
  method?: "get" | "put"
}

export class StorageClient {
  constructor(private config: StorageConfig) {}

  async upload(path: string, file: Uint8Array, mime: string): Promise<UploadResult> {
    throw new Error("StorageClient.upload not implemented — Phase 6")
  }

  async delete(path: string): Promise<void> {
    throw new Error("StorageClient.delete not implemented — Phase 6")
  }

  async getSignedUrl(path: string, opts?: SignedUrlOptions): Promise<string> {
    throw new Error("StorageClient.getSignedUrl not implemented — Phase 6")
  }
}
