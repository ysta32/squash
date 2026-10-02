/** Names of required build-time variables that are empty or absent. */
export function missingConfig(env: Record<string, string | undefined>): string[] {
  return ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !env[name]?.trim())
}
