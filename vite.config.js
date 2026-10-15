import { Buffer } from 'node:buffer'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Reads the "role" claim of a legacy Supabase JWT key without verifying it.
function jwtRole(key) {
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role
  } catch {
    return undefined
  }
}

// Stops the build if a privileged key would be bundled into the website,
// or if the production build is missing the Supabase settings.
function checkPublicEnv(mode) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const problems = []

  for (const [name, value] of Object.entries(env)) {
    const v = String(value || '').trim()
    if (v.startsWith('sb_secret_') || jwtRole(v) === 'service_role') {
      problems.push(`${name} contains a Supabase SECRET/service_role key. Use the public anon key instead.`)
    }
    if (/^AIza[0-9A-Za-z_-]{20,}$/.test(v) || /gsk_[0-9A-Za-z]{20,}/.test(v)) {
      problems.push(`${name} looks like a Gemini/Groq API key. AI keys belong in Supabase secrets, not VITE_ variables.`)
    }
  }

  const url = String(env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (mode === 'production') {
    if (!url) problems.push('VITE_SUPABASE_URL is not set.')
    if (!key) problems.push('VITE_SUPABASE_ANON_KEY is not set.')
  }
  if (key && key.startsWith('sb_publishable_')) {
    problems.push(
      'VITE_SUPABASE_ANON_KEY is a sb_publishable_ key. The chat/classify functions keep JWT verification on, ' +
      'which needs the legacy "anon" JWT key (Project Settings -> API Keys -> Legacy API keys).'
    )
  } else if (key && jwtRole(key) !== 'anon') {
    problems.push('VITE_SUPABASE_ANON_KEY is not a Supabase anon key.')
  }

  if (problems.length) {
    throw new Error('\n[EcoWasteAI env check]\n- ' + problems.join('\n- ') + '\n')
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') checkPublicEnv(mode)
  return {
    plugins: [react(), tailwindcss()],
  }
})
