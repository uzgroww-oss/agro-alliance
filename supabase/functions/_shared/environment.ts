export type Environment = "development" | "staging" | "production"
export type Branch = "main" | "dev" | "feature" | "local"

export interface EnvironmentInfo {
  environment: Environment
  branch: Branch
  isProduction: boolean
  isDevelopment: boolean
  isLocal: boolean
}

export function getEnvironment(): EnvironmentInfo {
  const env = (Deno.env.get("APP_ENV") ?? "development") as Environment
  return {
    environment: env,
    branch: getBranch(),
    isProduction: env === "production",
    isDevelopment: env === "development",
    isLocal: env === "development" && !Deno.env.get("SUPABASE_URL"),
  }
}

function getBranch(): Branch {
  const branch = Deno.env.get("BRANCH") ?? "local"
  if (branch === "main") return "main"
  if (branch === "dev") return "dev"
  if (branch?.startsWith("feat")) return "feature"
  return "local"
}
