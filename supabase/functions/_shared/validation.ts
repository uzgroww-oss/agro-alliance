export function required(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return `${field} majburiy`
  }
  return null
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

export function maxLength(value: string, max: number): boolean {
  return value.length <= max
}

export function minLength(value: string, min: number): boolean {
  return value.length >= min
}

export function validate(
  data: Record<string, unknown>,
  rules: Record<string, ((v: unknown) => string | null)[]>,
): string[] {
  const errors: string[] = []
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const error = rule(data[field])
      if (error) {
        errors.push(error)
        break
      }
    }
  }
  return errors
}

export function parsePaginationParams(url: URL): { page: number; per_page: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
  const per_page = Math.min(50, Math.max(1, parseInt(url.searchParams.get("per_page") || "12", 10)))
  return { page, per_page }
}

export function parseBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>
}
