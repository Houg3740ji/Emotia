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

      // ── Banco de ejemplos por coste × ambiente ─────────────────────────────
      // Clave: "coste|ambiente" (undefined = "cualquiera")
      const EXAMPLE_BANK: Record<string, string[]> = {
        'gratis|relajado':    [
          'Netflix + palomitas — Elegir serie nueva, hacer palomitas y taparos con mantas.',
          'Juegos de mesa — Sacar todos los juegos de casa y perder el tiempo riendo.',
          'Dibujo juntos — Poner papel, lápices y reíros de lo que sale.',
          'Cocinar lo que hay — Improvisar cena con lo que queda en la nevera.',
        ],
        'gratis|activo':      [
          'Fotos por el barrio — Salir con el móvil a buscar las imágenes más raras.',
          'Frisbee en el parque — Llevar un frisbee y jugar hasta cansaros.',
          'Explorar a pie — Elegir dirección aleatoria y ver qué encontráis.',
          'Yoga en casa — Seguir un vídeo de YouTube y hacer el ridículo juntos.',
        ],
        'gratis|romántico':   [
          'Picnic en el parque — Manta, comida de casa y lista de canciones vuestra.',
          'Baile en el salón — Hacer playlist de vuestras canciones y bailar en casa.',
          'Cartas a mano — Escribiros una carta y leerlas en voz alta.',
          'Estrellas en la terraza — Tumbarse con mantas a mirar el cielo.',
        ],
        'economico|relajado': [
          'Cine de barrio — Ir al cine más cercano a ver lo que echen.',
          'Cafetería nueva — Buscar una cafetería que no hayáis probado y pedir de todo.',
          'Mercadillo — Pasear por un rastro y ver quién encuentra la cosa más rara.',
          'Escape room económico — El más barato de la ciudad.',
        ],
        'economico|activo':   [
          'Bolos + cañas — Dos partidas de bolos y luego tomar algo en el bar.',
          'Karting — Echar unas vueltas y competir a ver quién es más peligroso.',
          'Paintball — Buscar oferta de grupo y pasar la tarde disparándoos.',
          'Bolera + pizza — Bolos y luego pedir pizza en el local de al lado.',
        ],
        'economico|romántico':[
          'Sushi casero — Comprar ingredientes, hacer makis y poner velas.',
          'Cena en sitio nuevo — Restaurante que no hayáis probado, pedir capricho.',
          'Taller de cerámica — Apuntarse a clase corta y hacer algo juntos.',
          'Cóctel en casa — Buscar recetas, comprar ingredientes y montar barra en casa.',
        ],
        'premium|relajado':   [
          'Spa en pareja — Reservar circuito de aguas y pasar la tarde relajados.',
          'Hotel con jacuzzi — Noche en hotel con bañera de hidromasaje.',
          'Masaje a domicilio — Pedir masajista profesional que venga a casa para los dos.',
          'Suite con vistas — Reservar habitación con terraza y no salir en todo el día.',
        ],
        'premium|activo':     [
          'Parapente biplaza — Vuelo en parapente sobre el paisaje.',
          'Kayak de alquiler — Medio día en kayak en un lago o río cercano.',
          'Escape room premium — El más elaborado y caro de la ciudad.',
          'Clase de surf — Apuntarse a clase de surf para principiantes.',
        ],
        'premium|romántico':  [
          'Menú degustación — Reservar en restaurante con menú degustación y maridaje.',
          'Escapada a otra ciudad — Noche de hotel especial en ciudad nueva.',
          'Cata de vinos guiada — Cata con sommelier y tabla de quesos.',
          'Cena privada con chef — Contratar chef que cocine en casa para los dos.',
        ],
      }

      // Seleccionar ejemplos relevantes
      const costKey = costFilter === 'gratuito'         ? 'gratis'
                    : costFilter === 'económico'        ? 'economico'
                    : costFilter === 'especial/premium' ? 'premium'
                    : null
      const moodKey = moodFilter === 'tranquilo y relajado' ? 'relajado'
                    : moodFilter === 'activo y divertido'   ? 'activo'
                    : moodFilter === 'romántico e íntimo'   ? 'romántico'
                    : null

      // Primero busca match exacto, luego solo coste, luego solo mood, luego cualquiera
      const bankKey = costKey && moodKey ? `${costKey}|${moodKey}`
                    : costKey            ? `${costKey}|relajado`
                    : moodKey            ? `gratis|${moodKey}`
                    : 'economico|relajado'
      const examples = EXAMPLE_BANK[bankKey] ?? EXAMPLE_BANK['economico|relajado']

      // Líneas de restricción MUY concretas
      const durLine  = durationFilter === 'menos de 1 hora' ? '- Duración MÁXIMA: 1 hora (algo rápido, sin desplazamientos largos)'
                     : durationFilter === '2 a 3 horas'     ? '- Duración: entre 2 y 3 horas'
                     : durationFilter === 'medio día o más' ? '- Duración MÍNIMA: 4 horas o más (excursión, evento de todo el día, etc.)'
                     : null
      const costLine = costFilter === 'gratuito'         ? '- Coste: CERO euros, usando solo lo que ya tenéis en casa o espacios públicos gratuitos'
                     : costFilter === 'económico'        ? '- Coste: entre 10 y 30€ en total para los dos'
                     : costFilter === 'especial/premium' ? '- Coste: más de 30€, algo fuera de lo habitual'
                     : null
      const moodLine = moodFilter === 'tranquilo y relajado' ? '- Ambiente: RELAJADO, sin esfuerzo físico, sentados o tumbados'
                     : moodFilter === 'activo y divertido'   ? '- Ambiente: ACTIVO, con movimiento físico, competición o energía'
                     : moodFilter === 'romántico e íntimo'   ? '- Ambiente: ROMÁNTICO, íntimo, con detalles especiales'
                     : null

      const restrictions = [durLine, costLine, moodLine].filter(Boolean)
      const restrictBlock = restrictions.length > 0
        ? `RESTRICCIONES OBLIGATORIAS:\n${restrictions.join('\n')}`
        : 'Sin restricciones.'

      const avoidLine = previousPlan
        ? `NO uses nada parecido a: "${previousPlan}"`
        : ''

      prompt =
`Genera un plan de cita para una pareja española.

${restrictBlock}
${avoidLine}

EJEMPLOS del tipo correcto (usa como referencia de estilo y tipo):
${examples.join('\n')}

Genera UN plan NUEVO y DIFERENTE a los ejemplos de arriba.
El título debe ser directo (2-4 palabras, la actividad concreta, sin adjetivos floridos).
La descripción debe decir exactamente qué harían.

Responde SOLO con estas dos líneas:
TITULO: [2-4 palabras]
DESCRIPCION: [máx 15 palabras]

Semilla: ${Math.floor(Math.random() * 999999)}`

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
