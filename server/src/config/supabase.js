const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

let supabaseAdmin = null

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  // Node 20 has no built-in WebSocket; Supabase Realtime requires `ws` on the server.
  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  })

  return supabaseAdmin
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

module.exports = { getSupabaseAdmin, isSupabaseConfigured }
