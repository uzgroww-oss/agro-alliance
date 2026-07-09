export interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export interface CacheConfig {
  ttl: number
  prefix: string
}

export class CacheClient {
  private store = new Map<string, CacheEntry<unknown>>()
  private defaultTtl: number

  constructor(private config: CacheConfig) {
    this.defaultTtl = config.ttl * 1000
  }

  private key(k: string): string {
    return `${this.config.prefix}:${k}`
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(this.key(key))
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(key))
      return null
    }
    return entry.data as T
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.store.set(this.key(key), {
      data: value,
      expiresAt: Date.now() + (ttl ? ttl * 1000 : this.defaultTtl),
    })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.key(key))
  }

  async invalidate(pattern: string): Promise<void> {
    const prefix = this.key(pattern)
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }
}
