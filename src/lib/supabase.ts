import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ptsemdsxmbwzstyoxeey.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_vkmilBvJBkXGNp4Ya9PP_w_1WtMhfSK'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

export type UserSettings = {
  id: string
  // AI model keys
  anthropic_key: string | null
  gemini_key: string | null
  openai_key: string | null
  // Integration keys
  airtable_key: string | null
  slack_key: string | null
  notion_key: string | null
  // Preferences
  default_model: 'claude' | 'gemini'
  theme: 'dark' | 'light'
  notifications_enabled: boolean
  agent_defaults: Record<string, any>
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function upsertUserSettings(userId: string, settings: Partial<UserSettings>) {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ id: userId, ...settings, updated_at: new Date().toISOString() })
  return !error
}