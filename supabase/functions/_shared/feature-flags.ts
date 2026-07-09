export type FeatureFlag =
  | "ai-news-engine"
  | "social-automation"
  | "media-processing"
  | "queue-system"
  | "analytics-dashboard"
  | "telegram-notifications"
  | "youtube-sync"
  | "oauth-google"

const defaultFlags: Record<FeatureFlag, boolean> = {
  "ai-news-engine": false,
  "social-automation": false,
  "media-processing": false,
  "queue-system": false,
  "analytics-dashboard": true,
  "telegram-notifications": false,
  "youtube-sync": true,
  "oauth-google": false,
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envKey = `FEATURE_${flag.toUpperCase().replace(/-/g, "_")}`
  const envOverride = Deno.env.get(envKey)
  if (envOverride !== undefined) {
    return envOverride === "true"
  }
  return defaultFlags[flag] ?? false
}
