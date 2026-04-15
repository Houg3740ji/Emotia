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
    lang?: string
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
  const descMatch  = raw.match(/DESCRIPCI[OÓ]N:\s*(.+)/i)
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
            locationFilter, durationFilter, costFilter, moodFilter, previousPlan, lang } = context

    // ── Prompts ──────────────────────────────────────────────────────────────

    let prompt: string
    let selectedFantasyCategory: string | undefined

    if (module === 'daily_question') {
      prompt =
`Eres un asistente de conexión emocional para parejas.
Genera UNA sola pregunta profunda en español para ${user1Name} y ${user2Name},
que llevan ${daysTogether} días juntos. Temporada: ${season}. Estado emocional: ${lastEmotion}.
La pregunta debe invitar a la reflexión genuina. Responde SOLO con la pregunta, sin comillas.`

    } else if (module === 'fantasy') {
      // Banco de categorías con ejemplos concretos y excitantes
      const FANTASY_CATS = [
        {
          key: 'sensorial',
          examples: [
            { t: 'Venda y sorpresa total',      d: 'Un@ lleva los ojos vendados. El otro guía cada toque durante 20 minutos sin hablar ni revelar qué viene.' },
            { t: 'Hielo y aceite caliente',     d: 'Alternad cubitos de hielo y aceite templado sobre la piel. Quien recibe cierra los ojos y no sabe qué viene.' },
            { t: 'Solo con una pluma',          d: 'Diez minutos de exploración solo con una pluma de marabú. Sin manos, sin hablar. Turnaos.' },
            { t: 'Masaje con vela de masaje',   d: 'Gotead cera de vela de masaje (baja temperatura) y masajead después. Veinte minutos cada uno. Sin prisa.' },
          ]
        },
        {
          key: 'role_play',
          examples: [
            { t: 'Extraños en el bar',          d: 'Quedadais en un bar y fingid no conoceros. Ligaros desde cero como si fuera la primera vez que os veis.' },
            { t: 'Servicio a habitación',       d: 'Un@ hace el pedido por teléfono. El otro llega como camarero del hotel. Toda la noche en personaje sin romperlo.' },
            { t: 'Masajista de lujo',           d: 'Un@ es cliente de spa exclusivo, el otro el masajista. Mesa, aceite, música ambient. Sin romper el personaje en ningún momento.' },
            { t: 'Vecinos que se lían',         d: 'Un@ llama a la puerta con cualquier excusa. El otro abre. Fingid que os veis por primera vez y dejadlo fluir.' },
          ]
        },
        {
          key: 'juego',
          examples: [
            { t: 'Ruleta de deseos secretos',   d: 'Cada uno escribe 6 deseos en papeles, doblados. Mezcladlos y sacad uno al azar por turnos. Lo que salga, se cumple esa noche.' },
            { t: 'Verdad o reto íntimo',        d: 'Por turnos: verdad es confesar una fantasía nunca dicha. Reto es que el otro decida qué hacéis durante tres minutos exactos.' },
            { t: 'Strip trivial en pareja',     d: 'Preguntas de cultura general. Cada error: una prenda menos. El perdedor final cumple un deseo del ganador sin límites.' },
            { t: 'Dados de instrucciones',      d: 'Cada uno escribe 6 instrucciones y las numera del 1 al 6. Tirad un dado por turnos y cumplidlas sin negociar.' },
          ]
        },
        {
          key: 'aventura',
          examples: [
            { t: 'Fuera de la cama esta noche', d: 'Ningún espacio habitual esta noche. Elegid juntos dónde, pero tiene que ser un lugar nuevo: cocina, terraza, escalera, lo que sea.' },
            { t: 'En el coche de noche',        d: 'Aparcamiento solitario, asientos reclinados, música baja. Como cuando erais jóvenes y no teníais otro sitio.' },
            { t: 'Terraza a medianoche',        d: 'Solo vosotros, la oscuridad y las estrellas. Llevar una manta. Sin planear nada más. Improvisar el resto.' },
            { t: 'Hotel de improviso',          d: 'Reservad esta noche un hotel cercano. Nada planeado más allá de eso. Los móviles en silencio al entrar.' },
          ]
        },
        {
          key: 'conexion',
          examples: [
            { t: '4 minutos mirándoos',         d: 'Sentaos frente a frente, sin hablar, sin reír. Solo miraros a los ojos cuatro minutos exactos. Es más íntimo de lo que parece.' },
            { t: 'Carta erótica en papel',      d: 'Cada uno escribe en papel lo que desea del otro esta noche. Intercambiad las cartas. Cumplidlas en el orden que salgan.' },
            { t: 'Sin palabras, media hora',    d: 'Comunicaros solo con el cuerpo durante treinta minutos. Sin hablar. Decidid lo que queráis sin abrir la boca.' },
            { t: 'Confesión nunca dicha',       d: 'Por turnos, confesad una fantasía que nunca habéis dicho en voz alta. Sin juzgar, sin comentar. Solo escuchar y aceptar.' },
          ]
        },
        {
          key: 'desafio',
          examples: [
            { t: 'Solo palabras, una hora',     d: 'Sin contacto físico durante 60 minutos. Solo describid con palabras exactas lo que queréis haceros. La tensión acumulada es el juego.' },
            { t: 'Fotos íntimas solo vuestras', d: 'Turnaos haciéndoos fotos el uno al otro. El fotógrafo decide la pose sin que el otro la vea venir. Las fotos son solo vuestras.' },
            { t: 'Striptease planificado',      d: 'Un@ prepara una playlist y ejecuta un striptease. El otro solo puede mirar, sin tocar, hasta que el otro lo autorice.' },
            { t: 'Lapso sin móviles',           d: 'Ocho horas sin pantallas. Solo vosotros dos. Sin plan fijo. Decidid en el momento qué queréis hacer.' },
          ]
        },
      ]

      const cat = FANTASY_CATS[Math.floor(Math.random() * FANTASY_CATS.length)]
      const ex  = cat.examples[Math.floor(Math.random() * cat.examples.length)]
      selectedFantasyCategory = cat.key

      prompt =
`Genera UNA fantasía íntima para adultos en una app de pareja.
Categoría: ${cat.key}.
Pareja: ${user1Name} y ${user2Name}, llevan ${daysTogether} días juntos.

REFERENCIA de estilo (no la copies, inspírate):
TITULO: ${ex.t}
DESCRIPCION: ${ex.d}

Requisitos estrictos:
- TITULO: 3-6 palabras, evocador, que genere curiosidad o tensión
- DESCRIPCION: 15-25 palabras exactas, instrucción concreta de qué hacer, con tensión sexual implícita pero sin ser explícito en exceso
- Específico y accionable, nunca vago ni genérico
- En español de España, tuteo (vosotros)
- Completamente diferente a la referencia

Responde EXACTAMENTE con estas dos líneas, sin nada más, sin explicaciones:
TITULO: [aquí]
DESCRIPCION: [aquí]

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
      const durLine  = lang === 'en'
        ? (durationFilter === 'menos de 1 hora' ? '- MAX duration: 1 hour (something quick, no long travel)'
         : durationFilter === '2 a 3 horas'     ? '- Duration: 2 to 3 hours'
         : durationFilter === 'medio día o más' ? '- MIN duration: 4+ hours (excursion, full-day event, etc.)'
         : null)
        : (durationFilter === 'menos de 1 hora' ? '- Duración MÁXIMA: 1 hora (algo rápido, sin desplazamientos largos)'
         : durationFilter === '2 a 3 horas'     ? '- Duración: entre 2 y 3 horas'
         : durationFilter === 'medio día o más' ? '- Duración MÍNIMA: 4 horas o más (excursión, evento de todo el día, etc.)'
         : null)
      const costLine = lang === 'en'
        ? (costFilter === 'gratuito'         ? '- Cost: ZERO, using only what you already have at home or free public spaces'
         : costFilter === 'económico'        ? '- Cost: between $10-30 total for both'
         : costFilter === 'especial/premium' ? '- Cost: over $30, something out of the ordinary'
         : null)
        : (costFilter === 'gratuito'         ? '- Coste: CERO euros, usando solo lo que ya tenéis en casa o espacios públicos gratuitos'
         : costFilter === 'económico'        ? '- Coste: entre 10 y 30€ en total para los dos'
         : costFilter === 'especial/premium' ? '- Coste: más de 30€, algo fuera de lo habitual'
         : null)
      const moodLine = lang === 'en'
        ? (moodFilter === 'tranquilo y relajado' ? '- Mood: RELAXED, no physical effort, sitting or lying down'
         : moodFilter === 'activo y divertido'   ? '- Mood: ACTIVE, physical movement, competition or energy'
         : moodFilter === 'romántico e íntimo'   ? '- Mood: ROMANTIC, intimate, with special touches'
         : null)
        : (moodFilter === 'tranquilo y relajado' ? '- Ambiente: RELAJADO, sin esfuerzo físico, sentados o tumbados'
         : moodFilter === 'activo y divertido'   ? '- Ambiente: ACTIVO, con movimiento físico, competición o energía'
         : moodFilter === 'romántico e íntimo'   ? '- Ambiente: ROMÁNTICO, íntimo, con detalles especiales'
         : null)

      const restrictions = [durLine, costLine, moodLine].filter(Boolean)
      const restrictBlock = restrictions.length > 0
        ? (lang === 'en' ? `MANDATORY RESTRICTIONS:\n${restrictions.join('\n')}` : `RESTRICCIONES OBLIGATORIAS:\n${restrictions.join('\n')}`)
        : (lang === 'en' ? 'No restrictions.' : 'Sin restricciones.')

      const avoidLine = previousPlan
        ? (lang === 'en' ? `DO NOT use anything similar to: "${previousPlan}"` : `NO uses nada parecido a: "${previousPlan}"`)
        : ''

      prompt = lang === 'en'
? `Generate a date plan for a couple. Respond ENTIRELY in English.

${restrictBlock}
${avoidLine}

STYLE EXAMPLES (use only as style/type reference, translate concepts to English):
${examples.join('\n')}

Generate ONE NEW plan DIFFERENT from the examples above.
Title: 2-4 words, the specific activity, no flowery adjectives.
Description: exactly what they would do, max 15 words.

Respond ONLY with these two lines in English:
TITULO: [2-4 words in English]
DESCRIPCION: [max 15 words in English]

Seed: ${Math.floor(Math.random() * 999999)}`
:
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
      result = { title, description, emoji: getEmoji(moodFilter), category: selectedFantasyCategory }

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
