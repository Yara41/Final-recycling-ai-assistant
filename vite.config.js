import { Buffer } from 'node:buffer'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The ONLY Supabase project this site may talk to (EcoWasteAI, region ap-south-1).
// It holds the existing `documents` table, `match_documents`, and the `chat` and
// `classify` Edge Functions. Keep in sync with supabase/config.toml and
// supabase/functions/_shared/security.ts (a Deno test checks all three match).
export const EXPECTED_SUPABASE_REF = 'uwxksbwlzjrjlccbdjtk'

// Reads the claims of a legacy Supabase JWT key without verifying it.
function jwtClaims(key) {
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) || {}
  } catch {
    return {}
  }
}
const jwtRole = (key) => jwtClaims(key).role

// Returns the project ref of https://<ref>.supabase.co, or undefined.
function urlRef(url) {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url)
  return match ? match[1] : undefined
}

// Stops the build (and the dev server) if a privileged key would be bundled into the
// website, if the Supabase values belong to another project, or if a production
// build is missing them.
function checkPublicEnv(mode, strict) {
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

  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (strict) {
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

  // Project ref validation: both values must belong to the EcoWasteAI project.
  if (url) {
    const ref = urlRef(url)
    if (!ref) {
      problems.push(`VITE_SUPABASE_URL must look like https://${EXPECTED_SUPABASE_REF}.supabase.co (no path).`)
    } else if (ref !== EXPECTED_SUPABASE_REF) {
      problems.push(`VITE_SUPABASE_URL points to project "${ref}", expected "${EXPECTED_SUPABASE_REF}".`)
    }
  }
  if (key && !key.startsWith('sb_')) {
    const keyRef = jwtClaims(key).ref
    if (keyRef !== EXPECTED_SUPABASE_REF) {
      problems.push(`VITE_SUPABASE_ANON_KEY belongs to project "${keyRef ?? 'unknown'}", expected "${EXPECTED_SUPABASE_REF}".`)
    }
  }

  if (problems.length) {
    throw new Error('\n[EcoWasteAI env check]\n- ' + problems.join('\n- ') + '\n')
  }
}

export default defineConfig(({ command, mode }) => {
  // Build: strict (missing values fail). Dev server: only checks values that are set.
  checkPublicEnv(mode, command === 'build' && mode === 'production')
  return {
    plugins: [react(), tailwindcss()],
  }
})
