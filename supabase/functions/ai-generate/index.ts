const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  module: 'daily_question' | 'fantasy' | 'date_plan'
  context: {
    user1Name: string
    user2Name: string
    daysTogether: number
    season: string
    lastEmotion: string
    locationFilter?: string
    costFilter?: string
    moodFilter?: string
  }
}

function getEmoji(mood?: string, loc?: string): string {
  if (mood === 'romántico e íntimo')                         return '🌹'
  if (mood === 'activo y divertido' && loc !== 'en casa')   return '🏃'
  if (mood === 'activo y divertido')                        return '🎮'
  if (mood === 'tranquilo y relajado' && loc !== 'en casa') return '🌿'
  if (mood === 'tranquilo y relajado')                      return '☕'
  return '✨'
}

function parseLines(raw: string): { title: string; description: string } {
  const titleMatch = raw.match(/TITULO:\s*(.+)/i)
  const descMatch  = raw.match(/DESCRIPCION:\s*(.+)/i)
  if (!titleMatch || !descMatch) {
    throw new Error(`Formato inesperado en respuesta de Groq: ${raw}`)
  }
  return { title: titleMatch[1].trim(), description: descMatch[1].trim() }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body: RequestBody = await req.json()
    const { module, context } = body

    if (!module || !context) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: module y context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user1Name, user2Name, daysTogether, season, lastEmotion,
            locationFilter, costFilter, moodFilter } = context

    // ── Prompts ──────────────────────────────────────────────────────────────

    let prompt: string

    if (module === 'daily_question') {
      prompt =
`Eres un asistente de conexión emocional para parejas.
Genera UNA sola pregunta profunda en español para ${user1Name} y ${user2Name},
que llevan ${daysTogether} días juntos. Temporada: ${season}. Estado emocional: ${lastEmotion}.
La pregunta debe invitar a la reflexión genuina. Responde SOLO con la pregunta, sin comillas.`

    } else if (module === 'fantasy') {
      prompt =
`Responde SOLO con estas dos líneas, sin nada más:
TITULO: [máx 5 palabras]
DESCRIPCION: [máx 12 palabras]

Idea íntima y romántica para la pareja ${user1Name} y ${user2Name}.

Ejemplo:
TITULO: Masaje a la luz de velas
DESCRIPCION: Turnarse con aceites aromáticos y música suave de fondo.

Ahora genera una diferente al ejemplo. Solo las dos líneas.
Semilla: ${Math.floor(Math.random() * 99999)}`

    } else if (module === 'date_plan') {
      const locDesc  = locationFilter === 'en casa'       ? 'en casa'
                     : locationFilter === 'fuera de casa' ? 'fuera de casa'
                     : 'en casa o fuera'
      const costDesc = costFilter === 'gratuito'          ? 'sin gastar dinero'
                     : costFilter === 'económico'         ? 'con presupuesto moderado'
                     : costFilter === 'especial/premium'  ? 'con presupuesto generoso'
                     : 'cualquier presupuesto'
      const moodDesc = moodFilter === 'tranquilo y relajado' ? 'tranquilo y relajado'
                     : moodFilter === 'activo y divertido'   ? 'activo y divertido'
                     : moodFilter === 'romántico e íntimo'   ? 'romántico e íntimo'
                     : 'cualquier ambiente'

      prompt =
`Responde SOLO con estas dos líneas, sin nada más:
TITULO: [máx 5 palabras]
DESCRIPCION: [máx 12 palabras]

Plan de cita para pareja: ${locDesc}, ${costDesc}, ${moodDesc}.

Ejemplo:
TITULO: Cena con velas en casa
DESCRIPCION: Cocinar juntos una receta especial con música suave.

Ahora genera uno diferente al ejemplo. Solo las dos líneas.
Semilla: ${Math.floor(Math.random() * 99999)}`

    } else {
      return new Response(
        JSON.stringify({ error: `Módulo desconocido: ${module}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Llamada a Groq ────────────────────────────────────────────────────────

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) throw new Error('GROQ_API_KEY no configurada')

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 150,
        temperature: 1.0,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      throw new Error(`Groq error ${groqRes.status}: ${errText}`)
    }

    const groqData = await groqRes.json()
    const raw = groqData.choices?.[0]?.message?.content ?? ''
    console.log(`[ai-generate] ${module} raw:`, raw)

    // ── Parsers ───────────────────────────────────────────────────────────────

    let result: unknown

    if (module === 'daily_question') {
      result = { question: raw.trim() }

    } else if (module === 'fantasy') {
      const { title, description } = parseLines(raw)
      result = { title, description, emoji: getEmoji(moodFilter) }

    } else {
      // date_plan — tipos asignados por el servidor, no por Groq
      const { title, description } = parseLines(raw)
      result = {
        title,
        description,
        emoji:         getEmoji(moodFilter, locationFilter),
        location_type: locationFilter === 'en casa' ? 'home' : 'outside',
        cost_type:     costFilter === 'gratuito'        ? 'free'
                     : costFilter === 'económico'       ? 'budget'
                     : 'premium',
        mood_type:     moodFilter === 'tranquilo y relajado' ? 'relaxed'
                     : moodFilter === 'activo y divertido'   ? 'energetic'
                     : 'romantic',
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[ai-generate]', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
