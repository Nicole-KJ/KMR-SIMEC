#!/usr/bin/env node
/**
 * SIMEC Keepalive Script
 * Runs on day 25 of each month to keep the Supabase free project active.
 * Schedule this with GitHub Actions or any cron service.
 * 
 * Usage: node keepalive.js
 * Cron:  0 9 25 * *   (9am on day 25 every month)
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

async function keepalive() {
  const now = new Date()
  console.log(`[SIMEC Keepalive] ${now.toISOString()} – Pinging Supabase...`)

  try {
    // Simple REST ping to the profiles table (requires auth – will return 401 but project stays active)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    })
    console.log(`[SIMEC Keepalive] Response: ${res.status} ${res.statusText}`)
    console.log('[SIMEC Keepalive] ✓ Project is active.')
  } catch (err) {
    console.error('[SIMEC Keepalive] ✗ Error:', err.message)
    process.exit(1)
  }
}

keepalive()
