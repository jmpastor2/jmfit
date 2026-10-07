import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional(),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  // Surface misconfiguration early and loudly in development.
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors)
}

const values: Partial<z.output<typeof schema>> = parsed.success ? parsed.data : {}

export const env = {
  supabaseUrl: values.VITE_SUPABASE_URL,
  supabaseAnonKey: values.VITE_SUPABASE_ANON_KEY,
  /** True when both Supabase values are present. The UI shows a setup screen otherwise. */
  isSupabaseConfigured: Boolean(values.VITE_SUPABASE_URL && values.VITE_SUPABASE_ANON_KEY),
  isDev: import.meta.env.DEV,
  appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0',
} as const
