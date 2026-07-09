export interface AppConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  r2: {
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    publicBucket: string
    privateBucket: string
    publicUrl: string
  }
  ai: {
    workerUrl: string
    apiKey: string
  }
  youtube: {
    apiKey: string
    channelId: string
  }
  telegram: {
    botToken: string
    chatId: string
  }
  oauth: {
    googleClientId: string
    googleSecret: string
  }
  app: {
    url: string
    name: string
    environment: "development" | "staging" | "production"
  }
}

function requireEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function loadConfig(): AppConfig {
  return {
    supabase: {
      url: requireEnv("SUPABASE_URL"),
      anonKey: requireEnv("SUPABASE_ANON_KEY"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    },
    r2: {
      endpoint: requireEnv("R2_ENDPOINT"),
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      publicBucket: requireEnv("R2_PUBLIC_BUCKET"),
      privateBucket: requireEnv("R2_PRIVATE_BUCKET"),
      publicUrl: requireEnv("R2_PUBLIC_URL"),
    },
    ai: {
      workerUrl: requireEnv("AI_WORKER_URL"),
      apiKey: requireEnv("AI_WORKER_API_KEY"),
    },
    youtube: {
      apiKey: requireEnv("YOUTUBE_API_KEY"),
      channelId: requireEnv("YOUTUBE_CHANNEL_ID"),
    },
    telegram: {
      botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
      chatId: requireEnv("TELEGRAM_CHAT_ID"),
    },
    oauth: {
      googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
      googleSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
    app: {
      url: requireEnv("VITE_API_URL"),
      name: "Agro Alliance",
      environment: (Deno.env.get("APP_ENV") as AppConfig["app"]["environment"]) ?? "development",
    },
  }
}
