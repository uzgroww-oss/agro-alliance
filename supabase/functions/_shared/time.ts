export function now(): string {
  return new Date().toISOString()
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000)
}

export function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now()
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "hozir"
  if (mins < 60) return `${mins} daqiqa oldin`
  if (hours < 24) return `${hours} soat oldin`
  if (days < 7) return `${days} kun oldin`
  return new Date(dateStr).toLocaleDateString("uz-UZ")
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

export function generateExpiryDate(ttlSeconds: number): string {
  return addSeconds(new Date(), ttlSeconds).toISOString()
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}
