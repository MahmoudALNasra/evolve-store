const { createClient } = require('@supabase/supabase-js')

let supabaseAdmin = null

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return supabaseAdmin
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

module.exports = { getSupabaseAdmin, isSupabaseConfigured }
