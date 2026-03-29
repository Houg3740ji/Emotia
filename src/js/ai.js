/**
 * EMOTIA — Cliente de IA (Groq via Supabase Edge Function)
 *
 * Uso:
 *   import { aiGenerate, buildContext } from '../ai.js'
 *   const ctx  = await buildContext(user, couple, partner)
 *   const data = await aiGenerate('daily_question', ctx)
 */

import { db } from '../supabase.js'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Llama a la Edge Function ai-generate.
 * @param {'daily_question'|'fantasy'|'date_plan'} module
 * @param {object} context  { user1Name, user2Name, daysTogether, season, lastEmotion }
 * @returns {Promise<object>}  El JSON que devuelve la función
 */
export async function aiGenerate(module, context) {
  console.log('[AI] Request body:', JSON.stringify({ module, context }))
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ module, context }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `Error de IA (${res.status})`)
  }

  return res.json()
}

/**
 * Construye el objeto context para la IA a partir de los datos de sesión.
 * @param {object|null} user    — objeto user de Supabase auth
 * @param {object|null} couple  — fila de couples
 * @param {object|null} partner — fila de users del compañero
 * @param {object}      [filters] — filtros opcionales { locationFilter, costFilter, moodFilter }
 * @returns {Promise<object>}
 */
export async function buildContext(user, couple, partner, filters = {}) {
  const daysTogether = couple?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(couple.created_at)) / 86_400_000))
    : 0

  const profile = await db.getMyProfile().catch(() => null)
  const user1Name = profile?.name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'tú'

  return {
    user1Name,
    user2Name:    partner?.name || 'tu pareja',
    daysTogether,
    season:       getSeason(),
    lastEmotion:  'amor',
    ...filters,
  }
}

/** Devuelve la estación actual en español según el mes del sistema. */
export function getSeason() {
  const m = new Date().getMonth() + 1   // 1–12
  if (m >= 3 && m <= 5)  return 'primavera'
  if (m >= 6 && m <= 8)  return 'verano'
  if (m >= 9 && m <= 11) return 'otoño'
  return 'invierno'
}
