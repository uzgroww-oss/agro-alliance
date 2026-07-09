export interface SearchQuery {
  text: string
  fields: string[]
  fuzzy?: boolean
  limit?: number
  offset?: number
}

export interface SearchResult<T> {
  items: T[]
  total: number
  relevance: number
}

export function buildSearchQuery(query: SearchQuery): { where: string; params: unknown[] } {
  const terms = query.text.trim().split(/\s+/)
  const conditions = terms.map((_, i) =>
    query.fields.map((f) => `${f} ILIKE $${i + 1}`).join(" OR ")
  )
  return {
    where: conditions.length > 0 ? `(${conditions.join(") AND (")})` : "1=1",
    params: terms.map((t) => `%${t}%`),
  }
}
