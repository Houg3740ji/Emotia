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

function cleanJSON(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()
}

function buildPrompt(module: string, ctx: RequestBody['context']): string {
  const { user1Name, user2Name, daysTogether, season, lastEmotion,
          locationFilter, costFilter, moodFilter } = ctx

  if (module === 'daily_question') {
    return `Eres un asistente especializado en conexión emocional para parejas.
Genera UNA sola pregunta profunda y original en español para una pareja
llamada ${user1Name} y ${user2Name} que llevan juntos ${daysTogether} días.
Es ${season}. Su estado emocional reciente es ${lastEmotion}.
La pregunta debe invitar a la reflexión emocional genuina y ser diferente
a preguntas típicas. Responde SOLO con la pregunta, sin comillas ni explicaciones.`
  }

  if (module === 'fantasy') {
    const today = new Date().toISOString().split('T')[0]
    return `Eres un asistente creativo para parejas. Genera UNA idea íntima y romántica
original en español para ${user1Name} y ${user2Name}. Debe ser sugerente pero elegante.
Sé creativo — cada idea debe ser diferente. Hoy es ${today}.
Responde ÚNICAMENTE con este JSON exacto, sin nada más:
{"title":"[título corto, máx 40 caracteres]","description":"[descripción de 1-2 frases, máx 120 caracteres]","emoji":"[1 emoji relevante]"}`
  }

  if (module === 'date_plan') {
    const locDesc  = locationFilter === 'en casa'       ? 'en casa'
                   : locationFilter === 'fuera de casa' ? 'fuera de casa'
                   : 'en casa o fuera'
    const costDesc = costFilter === 'gratuito'          ? 'sin gastar dinero'
                   : costFilter === 'económico'         ? 'con presupuesto moderado'
                   : costFilter === 'especial/premium'  ? 'con presupuesto generoso'
                   : 'cualquier presupuesto'
    const moodDesc = moodFilter === 'relajado y tranquilo' ? 'tranquilo y relajado'
                   : moodFilter === 'activo y dinámico'    ? 'activo y divertido'
                   : moodFilter === 'romántico e íntimo'   ? 'romántico e íntimo'
                   : 'cualquier ambiente'

    const today = new Date().toISOString().split('T')[0]

    return `Eres un asistente creativo para parejas. Genera UN plan de cita
en español para ${user1Name} y ${user2Name}.

Características del plan:
- Lugar: ${locDesc}
- Presupuesto: ${costDesc}
- Ambiente: ${moodDesc}

Sé creativo y original. Cada vez que generes un plan debe ser diferente. Hoy es ${today}.
Responde ÚNICAMENTE con este formato JSON exacto, sin nada más:
{"title":"[título corto y atractivo, máx 40 caracteres]","description":"[descripción de 1-2 frases, máx 120 caracteres]","emoji":"[1 emoji relevante]"}`
  }

  throw new Error(`Módulo desconocido: ${module}`)
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
        JSON.stringify({ error: 'Faltan campos requeridos: module y context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = buildPrompt(module, context)
    console.log('PROMPT:', prompt)

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY no configurada')
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 400,
        temperature: 0.9,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Error de Groq (${groqResponse.status}): ${errorText}`)
    }

    const groqData = await groqResponse.json()
    const rawContent = groqData.choices?.[0]?.message?.content ?? ''

    let result: unknown

    if (module === 'daily_question') {
      result = { question: rawContent.trim() }
    } else {
      // fantasy y date_plan devuelven JSON (Groq a veces lo envuelve en ```json```)
      try {
        result = JSON.parse(cleanJSON(rawContent))
      } catch {
        throw new Error(`La IA no devolvió JSON válido: ${rawContent}`)
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[ai-generate] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
