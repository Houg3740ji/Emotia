# PROMPT PARA GOOGLE STITCH — EMOTIA APP

Crea una app mobile completa llamada **Emotia** — una app para parejas que fomenta la conexion emocional diaria a traves de rituales compartidos. Las dos personas de la pareja tienen cuentas vinculadas y comparten experiencias en tiempo real.

La app debe sentirse 100% nativa de iOS con acabado premium. Usa React Native con Expo.

---

## ESTILO VISUAL GLOBAL (MUY IMPORTANTE)

Replica exactamente este estilo visual inspirado en apps premium de iOS:

- **Fondo**: crema/blanco calido suave (#FFF8F0 a #FFFFFF), nunca blanco puro frio
- **Color principal (accent)**: teal (#0D9488) para botones primarios, enlaces, acentos y degradados
- **Color secundario**: navy oscuro (#1E293B) para la tarjeta de Tregua y elementos oscuros
- **Tarjetas**: bordes redondeados grandes (border-radius: 20px), sombras muy suaves, efecto glassmorphism/neumorfismo ligero con fondo blanco semi-transparente
- **Tipografia**: SF Pro Display o sistema iOS. Titulos en bold/black, subtitulos en gris suave (#9CA3AF), cuerpo en regular
- **Ilustraciones**: En cada pantalla del onboarding, incluir una ilustracion grande estilo hand-drawn/sketch con acentos en teal (similar al gato dibujado a mano de la app Amy). Para Emotia, usar ilustraciones de pareja/corazones/emociones dibujadas a mano con lineas negras y acentos teal
- **Botones primarios**: forma pill redondeada, fondo teal solido, texto blanco, sombra suave
- **Botones secundarios/ghost**: borde fino gris, fondo transparente, texto gris oscuro
- **Iconos**: estilo SF Symbols de Apple, linea fina
- **Animaciones sugeridas**: fade-in + spring para entradas de pantalla, scale para selecciones, blur-to-reveal para desbloqueos
- **Bottom tab bar**: 5 tabs con iconos y labels, estilo nativo iOS, fondo blanco con blur
- **Modales/Settings**: presentados como bottom sheet con handle gris arriba (estilo iOS sheet presentation)
- **Espaciado generoso**: mucho aire entre elementos, padding lateral de 20-24px
- **Safe areas**: respetar notch, Dynamic Island y home indicator en todo momento

---

## ESTRUCTURA DE NAVEGACION

**Bottom Tabs** (5 pestanas):
1. **Inicio** (icono casa) — Pantalla principal
2. **Capsulas** (icono microfono) — Capsulas de audio
3. **Intimo** (icono candado) — Modo Intimo (protegido con PIN)
4. **Pacto** (icono escudo) — Pacto de Verdad
5. **Citas** (icono corazon con dado) — Ruleta de Citas

**Boton flotante (FAB)**: Siempre visible sobre el tab bar, icono de paloma/paz, color navy oscuro, para acceso urgente a la Tregua.

**Settings**: Accesible desde icono de engranaje en Home, se abre como bottom sheet modal.

**Onboarding**: Flujo separado de 7 pasos antes de mostrar los tabs.

---

## PANTALLA 1: ONBOARDING (7 pasos)

Cada paso tiene una barra de progreso con puntos en la parte superior (punto activo en teal, inactivos en gris claro). Ilustracion grande hand-drawn en la mitad superior. Contenido en la mitad inferior. Boton "Atras" (gris, circular con flecha) abajo izquierda. Boton "Siguiente" (teal, pill con flecha) abajo derecha. Animacion fade + spring al cambiar de paso.

### Paso 1 — Bienvenida
- Ilustracion: logo de Emotia grande (corazon teal con dos figuras abstractas dentro) + una pareja dibujada a mano estilo sketch debajo
- Titulo bold grande: "Bienvenidos a Emotia"
- Subtitulo gris: "Fortalece tu relacion con rituales diarios compartidos. Conecta emocionalmente con tu pareja cada dia."
- Boton grande teal pill: "Comenzar"
- Texto enlace debajo: "¿Ya tienes cuenta? Iniciar sesion" (teal, subrayado)

### Paso 2 — Autenticacion
- Ilustracion: pareja abrazandose dibujada a mano
- Titulo: "Crea tu cuenta"
- Campo email (input con borde gris redondeado, placeholder "tu@email.com")
- Campo contrasena (input con icono ojo para mostrar/ocultar)
- Boton teal: "Crear cuenta"
- Separador "o" con lineas
- Boton negro (estilo Apple): "Continuar con Apple" con icono Apple
- Boton blanco con borde: "Continuar con Google" con icono G de Google
- Texto enlace inferior: "¿Ya tienes cuenta? Inicia sesion"

### Paso 3 — Nombre
- Ilustracion: persona escribiendo con corazones alrededor
- Titulo bold: "¿Como te llamas?"
- Subtitulo gris: "Tu pareja vera este nombre en la app"
- Input grande centrado con placeholder "Tu nombre"
- El nombre aparece en grande con color teal mientras se escribe (preview en tiempo real)

### Paso 4 — Foto de perfil
- Ilustracion: camara dibujada a mano con corazones
- Titulo: "Anade tu foto"
- Subtitulo: "Para que tu pareja te reconozca"
- Circulo grande con borde punteado teal + icono de camara en el centro para subir foto
- Al subir: la foto aparece en el circulo con borde solido teal
- Texto enlace debajo: "Saltar por ahora" (gris)

### Paso 5 — Codigo de pareja
- Ilustracion: dos telefonos conectados con un hilo dibujado a mano
- Titulo: "Conecta con tu pareja"
- Subtitulo: "Comparte tu codigo o introduce el de tu pareja"
- Seccion "Tu codigo":
  - 6 cuadrados grandes con letras/numeros (estilo codigo de verificacion), fuente monoespaciada, color teal
  - Boton "Copiar" al lado con icono de copiar
- Separador "o"
- Seccion "Introduce el codigo de tu pareja":
  - 6 inputs individuales para cada caracter
  - Al completar los 6: validacion automatica con checkmark verde o error rojo

### Paso 6 — Aniversario
- Ilustracion: calendario con corazones y confeti dibujados a mano
- Titulo: "¿Cuando empezo todo?"
- Subtitulo: "Selecciona la fecha de inicio de vuestra relacion"
- Date picker estilo iOS nativo (ruedas de scroll para dia/mes/ano)
- Debajo del picker: texto dinamico "Llevais juntos X dias" con el calculo en tiempo real
- Badge pequeno: "Tus datos son privados y seguros" con icono candado

### Paso 7 — Permisos
- Ilustracion: campana de notificacion con corazones
- Titulo: "Mantente conectado/a"
- Subtitulo: "Necesitamos estos permisos para la mejor experiencia"
- Card 1: icono campana + "Notificaciones push" + subtitulo "Para saber cuando tu pareja te envia algo" + toggle switch
- Card 2: icono microfono + "Microfono" + subtitulo "Para grabar capsulas de audio para tu pareja" + toggle switch
- Boton teal grande: "Completar registro"
- Texto: "Puedes cambiar esto en Ajustes"

---

## PANTALLA 2: HOME (Pantalla de Inicio)

### Cabecera
- Izquierda: icono engranaje (gris) que abre Settings como bottom sheet
- Centro: texto "Emotia" en la tipografia del logo
- Sin elemento a la derecha

### Saludo
- Texto grande bold: "Hola, [nombre]" con emoji contextual segun la hora:
  - Manana (6-12): "Buenos dias, [nombre] ☀️"
  - Tarde (12-20): "Buenas tardes, [nombre] 🌤"
  - Noche (20-6): "Buenas noches, [nombre] 🌙"

### Tarjeta 1 — Pregunta del Dia (hero card)
- Fondo: degradado teal (de #0D9488 a #115E59)
- Esquina superior izquierda: pildora/badge con icono + "Reflexion" (u otra categoria)
- Esquina superior derecha: pildora con icono fuego + "5 dias seguidos" (racha)
- Centro: texto de la pregunta truncado a 2 lineas en blanco bold
- Inferior: "Toca para responder →" en blanco semi-transparente
- Sombra teal suave debajo de la tarjeta

### Tarjeta 2 — Estado Emocional
- Fondo: blanco con borde muy sutil
- Izquierda: emoji grande del estado actual del usuario (o "?" gris si no ha registrado hoy)
- Centro: titulo "Tu estado emocional" + subtitulo "Registra como te sientes hoy"
- Derecha: flecha ">" en gris
- Si ya registro: muestra el emoji seleccionado + nombre de la emocion

### Tarjeta 3 — Tregua
- Fondo: navy oscuro (#1E293B) con textura sutil
- Icono/emoji: paloma de paz animada (efecto flotacion)
- Titulo blanco: "Boton de Tregua"
- Subtitulo blanco semi-transparente: "Para momentos dificiles"
- Flecha blanca ">"

### FAB (Floating Action Button)
- Posicion: centrado horizontalmente, justo encima del tab bar
- Forma: circulo con icono de paloma/bandera blanca
- Color: navy (#1E293B)
- Sombra pronunciada
- Al pulsar: navega directamente a la pantalla de Tregua

---

## PANTALLA 3: PREGUNTA DEL DIA

### Badges superiores
- Pildora izquierda: icono + nombre de categoria (ej: "💭 Reflexion", "😂 Divertida", "📸 Nostalgia", "🔮 Futuro") con fondo teal suave
- Pildora derecha: "🔥 5 dias seguidos" con fondo naranja suave

### Tarjeta de pregunta
- Card grande con fondo blanco
- Comilla decorativa gigante ("") en teal con opacidad 10% detras del texto
- Texto de la pregunta en bold grande negro
- Debajo: estado de la pareja — "Tu pareja aun no ha respondido" (gris) o "Tu pareja ya respondio ✓" (verde)

### Area de respuesta
- Textarea grande con placeholder "Escribe tu respuesta..."
- Contador de caracteres abajo derecha (ej: "45/500")
- Boton "Enviar" (teal, pill) — deshabilitado (gris) hasta que haya contenido

### Respuesta bloqueada de la pareja
- Card con el texto de la pareja pero completamente borroso (efecto blur/frost)
- Icono de candado animado (pulso suave) en el centro
- Texto: "Responde primero para desbloquear"
- Al desbloquear: animacion de blur que se desvanece revelando el texto

### Reacciones emoji
- Al desbloquear la respuesta: fila de 5 emojis de reaccion: ❤️ 😂 😮 🥺 🔥
- Cada emoji tiene animacion de rebote al seleccionar
- Se puede seleccionar solo uno

### Historial
- Seccion "Preguntas anteriores" con scroll vertical
- Cada entrada: fecha legible ("Hace 3 dias"), pregunta truncada, dos puntos de colores indicando si ambos respondieron

---

## PANTALLA 4: CHECK-IN EMOCIONAL

### Titulo
- "¿Como te sientes hoy?" en bold grande

### Cuadricula de emociones
- Grid de 3 columnas x 5 filas con 15 emojis grandes
- SIN etiquetas de texto debajo de cada emoji (solo emojis)
- Emociones: 😊 Feliz · 😍 Enamorado/a · 🤩 Emocionado/a · 😌 En paz · 🥰 Carinoso/a · 🤔 Pensativo/a · 😢 Triste · 😰 Ansioso/a · 😤 Enfadado/a · 😴 Agotado/a · 😟 Preocupado/a · 🤗 Agradecido/a · 😏 Travieso/a · 🫠 Abrumado/a · 💪 Motivado/a
- Al seleccionar: el emoji se agranda con animacion spring + borde teal

### Nombre de la emocion
- Aparece con fade-in debajo del grid al seleccionar
- Texto en teal bold: nombre en espanol del estado (ej: "Enamorado/a")

### Tarjeta de consejo (solo para emociones negativas)
- Para tristeza, ansiedad, enfado, agotamiento, preocupacion
- Card con fondo teal suave con un mensaje de apoyo
- Icono de corazon + texto tipo: "Es valido sentirse asi. ¿Quieres que tu pareja lo sepa?"

### Estado de la pareja
- Card informativa: avatar circular pequeno de la pareja + emoji de su estado actual + nombre de la emocion
- Si no ha registrado: "Tu pareja aun no ha registrado su estado"

### Boton confirmar
- Boton grande teal: "Confirmar estado"
- Deshabilitado (gris) hasta que se seleccione un emoji
- Al confirmar: haptico + guardado + actualizacion en tiempo real

---

## PANTALLA 5: BOTON DE TREGUA (SOS)

### Pantalla principal
- Fondo oscuro navy (#1E293B) con gradiente sutil
- Emoji de paloma grande con animacion de flotacion suave
- Titulo blanco grande: "Tregua"
- Subtitulo blanco semi-transparente: "Un espacio seguro para reconectar"
- Boton grande circular o pill: "Activar Tregua" (borde blanco, fondo transparente, texto blanco)
- Texto pequeno: "Ambos deben confirmar para iniciar"

### Mecanismo de confirmacion
- Usuario pulsa "Activar Tregua" → se envia push notification a la pareja
- Aparece contador circular de 60 segundos con animacion
- Texto: "Esperando a [nombre de pareja]..."
- Si la pareja confirma antes de 60s: ambos entran a Fase 1 con animacion de transicion

### Fase 1 — Respiracion (minimo 36 segundos)
- 3 circulos concentricos con animacion de pulso en teal (se expanden y contraen)
- Texto ciclico grande centrado: "Inspira..." (4s) → "Manten..." (4s) → "Suelta..." (4s)
- Repite 3 veces minimo
- Hapticos suaves sincronizados con la respiracion
- Boton "Continuar" aparece despues de 36s

### Fase 2 — Turnos de habla
- Indicador grande de a quien le toca: "[Nombre] habla" con avatar
- Temporizador circular: 2:00 minutos contando hacia atras
- El timer se vuelve amber/naranja cuando quedan 0:30
- Boton "Cambiar turno" para pasar al otro
- Instruccion: "Escucha sin interrumpir"

### Fase 3 — Reconexion
- 5 tarjetas horizontales deslizables (carousel) con frases de reconexion
- Ejemplos: "Te quiero aunque estemos enfadados", "Eres mas importante que esta discusion", "Quiero entenderte", "Somos un equipo", "Gracias por estar aqui"
- Cada tarjeta: fondo teal con texto blanco grande
- Boton en cada tarjeta: "Enviar a [nombre]" → envia la frase como push notification

---

## PANTALLA 6: CAPSULAS DE AUDIO

### Pantalla principal
- Titulo grande: "Capsulas de Audio"
- Subtitulo: "Envia mensajes de voz especiales"

### Grid de categorias (2 columnas, 5 filas)
10 tarjetas cuadradas con icono + nombre de categoria:
1. 🙏 Gratitud
2. 🌙 Cuento para dormir
3. 📸 Recuerdos
4. 💌 Carta de amor
5. 😂 Hazme reir
6. 💪 Animo
7. 🎵 Cancion
8. 🔥 Confesion
9. 🌅 Buenos dias
10. ❓ Sin categoria

Cada tarjeta: fondo blanco, borde redondeado, sombra suave, emoji grande centrado, nombre debajo

### Lista de capsulas recibidas (debajo del grid)
- Seccion "Recibidas"
- Cada entrada: avatar de pareja + categoria + duracion + timestamp
- Punto azul de "no leida" para capsulas nuevas

### Pantalla de grabacion (al tocar una categoria)
- Estado idle: boton circular grande rojo con icono microfono + "Manten para grabar"
- Estado grabando: punto rojo pulsante + temporizador + onda de audio animada en tiempo real
- Al soltar: preview del audio con boton play + boton "Enviar" (teal) + boton "Descartar" (rojo ghost)

### Pantalla de reproduccion (al tocar una capsula recibida)
- Onda de audio con 15 barras animadas
- Barra de progreso lineal
- Boton play/pause grande central
- Control de velocidad: 1x / 1.5x / 2x (pildoras seleccionables)
- Nombre de quien envio + categoria + fecha

---

## PANTALLA 7: MODO INTIMO (protegido con PIN)

### Puerta PIN
- Fondo oscuro navy
- Titulo: "Modo Intimo"
- Subtitulo: "Introduce tu PIN de 4 digitos"
- 4 puntos indicadores (vacios → llenos al escribir)
- Teclado numerico estilo iOS nativo (numeros grandes, boton borrar)
- Sin limite de intentos
- Opcion de Face ID/Touch ID si esta activado

### Tab 1 — Fantasias (pestana superior)
- Tarjetas estilo Tinder apiladas en el centro
- Cada tarjeta: fondo con degradado oscuro + icono/emoji + titulo de fantasia + categoria (badge)
- **Swipe derecha** = interesado/a (aparece corazon verde)
- **Swipe izquierda** = no interesado/a (aparece X roja)
- **Swipe arriba** = "quizas" (aparece signo ? amarillo)
- Cuando ambos hacen swipe derecha en la misma fantasia: animacion de match con confeti + notificacion "¡Coincidencia!"
- Seccion inferior: "Vuestras coincidencias" — lista de fantasias donde ambos dijeron si

### Tab 2 — Reto Semanal (pestana superior)
- Una tarjeta grande oscura centrada
- Emoji grande arriba
- Titulo del reto en blanco bold
- Descripcion en blanco semi-transparente
- Badge: "Reto de la semana"
- Boton: "Marcar como completado ✓" (teal)
- Indicador si ambos lo completaron
- Se renueva cada lunes

---

## PANTALLA 8: PACTO DE VERDAD

### Estructura
- Indicador de progreso arriba: 3 circulos (● ○ ○ → ● ● ○ → ● ● ●) mostrando pregunta actual
- Badge de advertencia: "⚠️ Contenido profundo" con fondo amarillo suave

### Tarjeta de pregunta
- Card grande con cabecera en degradado teal
- Pregunta en texto blanco grande bold
- Misma mecanica de bloqueo que Pregunta del Dia:
  - Textarea para escribir respuesta
  - Respuesta de pareja bloqueada con blur + candado
  - Se desbloquea al responder
  - Reacciones emoji disponibles

### Navegacion
- Boton izquierda: "Saltar" (ghost/gris)
- Boton derecha: "Responder →" (teal)
- No se puede avanzar a la siguiente pregunta sin haber respondido o saltado la actual
- Nuevas preguntas cada semana, las anteriores van al historial

---

## PANTALLA 9: RULETA DE CITAS

### Filtros (parte superior)
- 4 pildoras/chips seleccionables (seleccion multiple):
  - 🏠 En casa
  - 🌳 Fuera
  - 💰 Low Cost
  - ✨ VIP
- Seleccionado: fondo teal + texto blanco. No seleccionado: fondo gris claro + texto gris

### Boton girar (centro)
- Circulo grande central con emoji 🎰 y texto "GIRAR"
- Al pulsar: animacion de giro/ruleta (rotacion + rebote)

### Revelacion del plan
- Tarjeta gris que aparece con overlay tipo "rasca y gana"
- Animacion automatica de rascado que revela el contenido:
  - Emoji grande del plan
  - Titulo del plan en bold
  - Descripcion del plan
  - Badges con los filtros aplicados

### Confirmacion
- Boton: "Aceptar y firmar ✍️" (teal)
- Al aceptar: guarda como cita pendiente + push notification a la pareja

### Historial de citas (scroll inferior)
- Lista de planes anteriores
- Cada entrada: emoji + nombre + fecha
- Badge de estado: "Completada ✓" (verde) o "Pendiente ⏳" (naranja)

---

## PANTALLA 10: AJUSTES (Settings)

Se abre como bottom sheet modal desde el icono de engranaje en Home. Handle gris en la parte superior. Boton X arriba derecha para cerrar.

### Tarjeta de perfil (hero)
- Avatar circular grande con borde teal
- Nombre del usuario en bold
- Contador dinamico: "Juntos desde hace X meses y Y dias" calculado desde la fecha de aniversario

### Secciones (cards agrupadas con separadores, estilo Settings de iOS):

**Mi Perfil**
- Editar nombre → abre input inline
- Cambiar foto → abre picker de imagen

**Mi Pareja**
- "Tu codigo: XXXXXX" con boton copiar
- Input para vincular pareja (si no esta vinculada)
- Si vinculada: avatar + nombre de la pareja + boton "Desvincular" (rojo ghost)

**Modo Intimo**
- "Cambiar PIN" → flujo de introducir PIN actual + nuevo PIN
- Toggle: "Usar Face ID / Touch ID"

**Notificaciones** (4 toggles switch estilo iOS)
- Pregunta del dia
- Check-in emocional
- Capsulas de audio
- Tregua

**Privacidad**
- Toggle: "Bloquear app con Face ID / Touch ID"

**Preferencias**
- Selector de idioma (Espanol por defecto)
- Selector de tema: Claro / Oscuro / Sistema (3 opciones como segmented control)

**Cuenta**
- Boton "Cerrar sesion" (texto teal)
- Boton "Eliminar cuenta" (texto rojo) → dialogo de confirmacion de 2 pasos

---

## DATOS Y CONTENIDO DE EJEMPLO

### Banco de 20 preguntas del dia (5 por categoria):

**Emocionales:**
1. ¿Cual es el momento en el que mas me has necesitado y no he estado?
2. ¿Que es lo que mas miedo te da de nuestra relacion?
3. ¿Cuando fue la ultima vez que lloraste por algo relacionado conmigo?
4. ¿Que parte de ti sientes que no conozco todavia?
5. ¿Que necesitas de mi que no te estoy dando?

**Divertidas:**
6. ¿Cual es la cosa mas ridicula que hemos hecho juntos?
7. Si pudieramos teletransportarnos ahora mismo, ¿a donde irias?
8. ¿Que serie describe mejor nuestra relacion?
9. ¿Cual es mi peor habito que secretamente te hace gracia?
10. Si tuvieras que describir nuestro primer beso en una pelicula, ¿que genero seria?

**Nostalgicas:**
11. ¿Cual fue el primer detalle mio que te enamoro?
12. ¿Que momento de nuestra relacion revives en tu cabeza a menudo?
13. ¿Recuerdas que cancion sonaba en nuestra primera cita?
14. ¿Cual es la foto favorita que tienes de nosotros?
15. ¿Que es lo que mas echas de menos del principio de la relacion?

**Futuro:**
16. ¿Donde te imaginas que estaremos dentro de 5 anos?
17. ¿Que aventura quieres que vivamos juntos antes de ser viejos?
18. ¿Como imaginas nuestra vida ideal un domingo cualquiera?
19. ¿Que tradicion quieres que creemos juntos?
20. Si escribieras una carta a nuestro yo del futuro, ¿que diria?

### 15 emociones del check-in:
😊 Feliz · 😍 Enamorado/a · 🤩 Emocionado/a · 😌 En paz · 🥰 Carinoso/a · 🤔 Pensativo/a · 😢 Triste · 😰 Ansioso/a · 😤 Enfadado/a · 😴 Agotado/a · 😟 Preocupado/a · 🤗 Agradecido/a · 😏 Travieso/a · 🫠 Abrumado/a · 💪 Motivado/a

### 5 frases de reconexion (Tregua Fase 3):
1. "Te quiero aunque estemos enfadados"
2. "Eres mas importante que esta discusion"
3. "Quiero entenderte, no ganar"
4. "Somos un equipo, siempre"
5. "Gracias por estar aqui, incluso ahora"

### 10 categorias de capsulas de audio:
🙏 Gratitud · 🌙 Cuento para dormir · 📸 Recuerdos · 💌 Carta de amor · 😂 Hazme reir · 💪 Animo · 🎵 Cancion · 🔥 Confesion · 🌅 Buenos dias · ❓ Sin categoria

### Planes de cita de ejemplo:
- 🍳 "Desayuno en la cama" (En casa, Low Cost)
- 🌅 "Ver el atardecer desde un mirador" (Fuera, Low Cost)
- 🍝 "Cocinar pasta italiana juntos" (En casa, Low Cost)
- 🎭 "Noche de teatro" (Fuera, VIP)
- 🧖 "Dia de spa en pareja" (Fuera, VIP)
- 🎮 "Torneo de videojuegos con snacks" (En casa, Low Cost)
- 🍷 "Cena en restaurante sorpresa" (Fuera, VIP)
- 🏖️ "Escapada a la playa" (Fuera, VIP)
- 📺 "Maraton de peliculas con palomitas" (En casa, Low Cost)
- 🎨 "Pintarse retratos mutuos" (En casa, Low Cost)

---

## RESUMEN DE PANTALLAS A GENERAR

1. **Onboarding** — 7 pantallas (Bienvenida, Auth, Nombre, Foto, Codigo pareja, Aniversario, Permisos)
2. **Home** — Con saludo, 3 tarjetas hero y FAB
3. **Pregunta del Dia** — Con pregunta, respuesta, bloqueo, reacciones e historial
4. **Check-in Emocional** — Grid 15 emojis, consejo, estado pareja
5. **Tregua** — Pantalla principal + confirmacion + 3 fases (respiracion, turnos, reconexion)
6. **Capsulas de Audio** — Grid categorias + grabacion + reproduccion
7. **Modo Intimo** — PIN + Fantasias (Tinder swipe) + Reto Semanal
8. **Pacto de Verdad** — 3 preguntas con bloqueo
9. **Ruleta de Citas** — Filtros + ruleta + revelacion + historial
10. **Settings** — Bottom sheet con todas las secciones

Genera TODAS las pantallas con datos de ejemplo realistas, el estilo visual premium descrito, y navegacion funcional entre ellas. La app debe verse como si fuera una app nativa de Apple publicada en el App Store, con acabado profesional y atencion al detalle en cada pixel.
