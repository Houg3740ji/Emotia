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
    durationFilter?: string
    costFilter?: string
    moodFilter?: string
    previousPlan?: string
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
            locationFilter, durationFilter, costFilter, moodFilter, previousPlan } = context

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
      // Construir descripción de cada filtro
      const durDesc  = durationFilter === 'menos de 1 hora' ? 'que dure menos de 1 hora'
                     : durationFilter === '2 a 3 horas'     ? 'que dure entre 2 y 3 horas'
                     : durationFilter === 'medio día o más' ? 'que sea de medio día o más'
                     : null

      const costDesc = costFilter === 'gratuito'          ? 'completamente gratuito (sin gastar dinero)'
                     : costFilter === 'económico'         ? 'con presupuesto moderado (10-30€)'
                     : costFilter === 'especial/premium'  ? 'con presupuesto generoso (más de 30€)'
                     : null

      const moodDesc = moodFilter === 'tranquilo y relajado' ? 'de ambiente tranquilo y relajado'
                     : moodFilter === 'activo y divertido'   ? 'activo, dinámico y divertido'
                     : moodFilter === 'romántico e íntimo'   ? 'romántico e íntimo'
                     : null

      const constraints = [durDesc, costDesc, moodDesc].filter(Boolean)
      const constraintLine = constraints.length > 0
        ? `El plan debe ser: ${constraints.join(', ')}.`
        : 'Sin restricciones especiales de tipo.'

      const avoidLine = previousPlan
        ? `Importante: NO repitas ni algo parecido a "${previousPlan}". Genera algo completamente distinto.`
        : ''

      prompt =
`Responde SOLO con estas dos líneas, sin nada más:
TITULO: [máx 6 palabras, nombre concreto del plan]
DESCRIPCION: [máx 15 palabras, qué harían exactamente]

Genera un plan de cita real y concreto para una pareja.
${constraintLine}
${avoidLine}

Reglas:
- Debe ser algo que la gente haría de verdad, cotidiano pero especial
- El título debe sonar natural, no genérico (evita "noche mágica", "momento especial", etc.)
- La descripción debe decir exactamente qué van a hacer

Ejemplos de planes buenos según ambiente:
Relajado: "Tarde de alfarería en casa" / "Comprar arcilla y hacer cuencos juntos mientras escucháis música."
Relajado: "Maratón de serie nueva" / "Elegir una serie desconocida, hacer palomitas y taparos con mantas."
Activo: "Ruta en bici al mirador" / "Pedalear hasta el mirador, llevar bocadillos y hacer fotos."
Activo: "Noche de bolos y cervezas" / "Jugar dos partidas de bolos y tomarse unas cañas después."
Romántico: "Sushi casero desde cero" / "Comprar ingredientes, hacer makis juntos y poner velas."
Romántico: "Picnic nocturno en la terraza" / "Mantas, luces de hada, queso, vino y música suave."

Ahora genera UNO diferente a todos los ejemplos. Solo las dos líneas.
Semilla aleatoria: ${Math.floor(Math.random() * 999999)}`

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
        temperature: 1.1,
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
        location_type: locationFilter === 'en casa'       ? 'home'
                     : locationFilter === 'fuera de casa' ? 'outside'
                     : undefined,
        cost_type:     costFilter === 'gratuito'         ? 'free'
                     : costFilter === 'económico'        ? 'budget'
                     : costFilter === 'especial/premium' ? 'premium'
                     : undefined,
        mood_type:     moodFilter === 'tranquilo y relajado' ? 'relaxed'
                     : moodFilter === 'activo y divertido'   ? 'energetic'
                     : moodFilter === 'romántico e íntimo'   ? 'romantic'
                     : undefined,
        duration_label: durationFilter === 'menos de 1 hora' ? '<1h'
                      : durationFilter === '2 a 3 horas'     ? '2-3h'
                      : durationFilter === 'medio día o más' ? 'Larga'
                      : undefined,
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
