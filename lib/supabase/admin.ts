import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente exclusivo para ações administrativas executadas no servidor.
 * Nunca exponha SUPABASE_SERVICE_ROLE_KEY ao navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variáveis administrativas do Supabase não configuradas.')
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
