/**
 * EMOTIA — Sistema de internacionalización (i18n)
 * Traducciones ES / EN para toda la app.
 */

const TRANSLATIONS = {
  es: {
    // ── Común ───────────────────────────────────────────────────
    copy:       'Copiar',
    codeCopied: 'Código copiado ✓',

    // ── Home ────────────────────────────────────────────────────
    home: {
      noCouple:       'Sin pareja vinculada',
      yourCode:       'Tu código:',
      noEmotion:      'Sin registrar',
      pending:        'pendientes',
      completedToday: 'completadas hoy',
      entry:          'entrada',
      entries:        'entradas',
      partnerStatus:  'ha registrado su estado',
    },

    // ── Check-in ─────────────────────────────────────────────────
    checkin: {
      selectEmotion: 'Selecciona cómo te sientes',
      linkFirst:     'Vincula tu cuenta con tu pareja primero',
      saved:         'Estado guardado:',
      noLinked:      'SIN VINCULAR',
      linkPartner:   'Vincula tu pareja',
      notRegistered: 'Aún no ha registrado',
    },

    // ── Emociones ─────────────────────────────────────────────────
    emotions: {
      happy:        { name: 'Feliz',        support: 'Tu alegría también nutre a tu pareja. Compártela con ella hoy.' },
      inLove:       { name: 'Enamorado/a',  support: 'Exprésalo. Las palabras y los gestos también enamoran.' },
      excited:      { name: 'Emocionado/a', support: '¡Contagia esa energía! Cuéntale a tu pareja qué te tiene así.' },
      peaceful:     { name: 'En paz',       support: 'La calma interior te hace más presente para quienes quieres.' },
      affectionate: { name: 'Cariñoso/a',   support: 'Un abrazo o un detalle hoy puede hacer el día de tu pareja.' },
      thoughtful:   { name: 'Pensativo/a',  support: 'Compartir lo que ronda tu cabeza puede aclararlo todo.' },
      sad:          { name: 'Triste',       support: 'Es válido sentirse así. ¿Quieres que tu pareja lo sepa?' },
      anxious:      { name: 'Ansioso/a',    support: 'La ansiedad pasa. Respira y comparte cómo te sientes.' },
      angry:        { name: 'Enfadado/a',   support: 'Está bien sentir enfado. Compártelo con calma cuando puedas.' },
      exhausted:    { name: 'Agotado/a',    support: 'Necesitas descanso. Tu pareja puede apoyarte.' },
      worried:      { name: 'Preocupado/a', support: 'No estás solo/a. Compartir lo que te preocupa alivia.' },
      grateful:     { name: 'Agradecido/a', support: 'Dile a tu pareja algo que aprecias de ella hoy.' },
      mischievous:  { name: 'Travieso/a',   support: 'Esa chispa es energía para conectar con tu pareja de un modo especial.' },
      overwhelmed:  { name: 'Abrumado/a',   support: 'Tómatelo con calma. Un paso a la vez, y no tienes que hacerlo solo/a.' },
      motivated:    { name: 'Motivado/a',   support: 'Usa esa energía para algo que os acerque como pareja.' },
    },

    // ── Reflexión ─────────────────────────────────────────────────
    reflection: {
      dateLabel:        'Pregunta del día',
      writeFirst:       'Escribe tu reflexión antes de guardar',
      linkFirst:        'Vincula tu pareja para guardar reflexiones',
      noQuestion:       'No hay pregunta disponible hoy',
      saved:            'Reflexión guardada ✓',
      saveError:        'Error al guardar',
      notAnsweredYet:   'aún no ha respondido',
      saveToSee:        'Guarda tu reflexión para ver la de',
      reactionSaved:    'Reacción guardada',
      reactionError:    'Error al guardar reacción',
      updateBtn:        'Actualizar reflexión',
    },

    // ── Cápsulas ──────────────────────────────────────────────────
    capsules: {
      cats: {
        gratitud:      'Gratitud',
        recuerdos:     'Recuerdos',
        carta:         'Carta de amor',
        humor:         'Hazme reír',
        animo:         'Ánimo',
        cancion:       'Canción',
        confesion:     'Confesión',
        buenos_dias:   'Buenos días',
        sin_categoria: 'Sin categoría',
      },
      tapToRecord:  'Toca para grabar',
      recording:    'Grabando… toca para parar',
      micDenied:    'Permiso de micrófono denegado',
      micError:     'No se pudo acceder al micrófono',
      readyToSend:  'Grabación lista — revisa antes de enviar',
      linkFirst:    'Necesitas tener pareja vinculada para enviar cápsulas',
      sent:         'Cápsula enviada ✓',
      recordNew:    'Grabar nueva',
    },

    // ── Tareas ────────────────────────────────────────────────────
    tasks: {
      noPending:        '¡Sin tareas pendientes!',
      noCompleted:      'Aún no hay tareas completadas',
      noCouple:         'Sin pareja vinculada',
      noCoupleHint:     'Vincula tu pareja para gestionar tareas juntos',
      completed:        '¡Tarea completada! ✓',
      completeError:    'Error al completar',
      deleteError:      'Error al eliminar',
      partnerCompleted: 'completó una tarea ✓',
      partnerAdded:     'añadió una tarea',
      assignedBoth:     'Ambos',
      assignedMe:       'Yo',
      assignedTo:       'Asignada a:',
      completedBy:      'Completada por',
      at:               'a las',
      priorityHigh:     'Alta',
      priorityMedium:   'Media',
      priorityLow:      'Baja',
      namePlaceholder:  'Nombre de la tarea...',
      newTask:          'Nueva Tarea',
      priority:         'Prioridad',
      assignTo:         'Asignar a',
      createTask:       'Crear Tarea',
      partner:          'Pareja',
    },

    // ── Ruleta ────────────────────────────────────────────────────
    roulette: {
      noPlans:      'Sin planes para esa combinación. Prueba con menos filtros.',
      closestPlan:  'No hay planes exactos, mostrando el más cercano',
      dateBooked:   '¡Cita anotada! Que la disfruten 🎉',
      linkFirst:    'Vincula tu pareja para guardar la cita',
      dateSaved:    '¡Cita guardada! Que la disfruten 🎉',
      dateSavedBtn: 'Cita anotada',
      dateSaveBtn2: 'Cita guardada',
      accept:       'Aceptar esta cita',
      saveError:    'Error al guardar la cita',
    },

    // ── Notas ─────────────────────────────────────────────────────
    notes: {
      linkFirst:  'Vincula tu pareja para ver el historial',
      empty:      'Aún no hay reflexiones guardadas.<br/>Responde la pregunta diaria para empezar.',
      subtitle:   'entrada',
      subtitlePl: 'entradas',
      subtitleSuffix: '· últimos 30 días',
      loadError:  'Error al cargar el historial',
    },

    // ── Ajustes ───────────────────────────────────────────────────
    settings: {
      myProfile:        'Mi Perfil',
      name:             'Nombre',
      edit:             'Editar',
      myPartner:        'Mi Pareja',
      yourCode:         'Tu código',
      copy:             'Copiar',
      notifications:    'Notificaciones',
      dailyQuestion:    'Pregunta del día',
      emotionalCheckin: 'Check-in emocional',
      audioCapsules:    'Cápsulas de audio',
      preferences:      'Preferencias',
      langLabel:        'Idioma',
      themeLabel:       'Tema',
      themeLight:       'Claro',
      themeDark:        'Oscuro',
      themeSystem:      'Sistema',
      account:          'Cuenta',
      signOut:          'Cerrar sesión',
      deleteAccount:    'Eliminar cuenta',
      nameTooShort:     'El nombre es demasiado corto',
      nameUpdated:      'Nombre actualizado ✓',
      nameError:        'Error al actualizar nombre',
      photoUpdated:     'Foto actualizada ✓',
      photoError:       'Error al subir foto',
      codeLength:       'Introduce un código de 6 caracteres',
      partnerLinked:    '¡Pareja vinculada! 🎉',
      codeNotFound:     'Código no encontrado',
      unlinkInfo:       'Contacta con soporte para desvincular',
      langToastEs:      'Idioma: Español',
      langToastEn:      'Language set to English',
      themeToastDark:   '🌙 Tema oscuro activado',
      themeToastLight:  '☀️ Tema claro activado',
      themeToastSystem: '🖥️ Tema del sistema',
      codeCopied:       'Código copiado ✓',
      signOutError:     'Error al cerrar sesión',
      deleteConfirm:    '¿Seguro? Toca de nuevo para confirmar',
      deleteInfo:       'Para eliminar tu cuenta contacta a soporte@emotia.app',
    },

    // ── Router ────────────────────────────────────────────────────
    router: {
      loadError:    'Error al cargar la pantalla',
      unknownError: 'Error desconocido',
      retry:        'Reintentar',
    },
  },

  // ══════════════════════════════════════════════════════════════
  // ENGLISH
  // ══════════════════════════════════════════════════════════════
  en: {
    // ── Common ────────────────────────────────────────────────────
    copy:       'Copy',
    codeCopied: 'Code copied ✓',

    // ── Home ─────────────────────────────────────────────────────
    home: {
      noCouple:       'No partner linked',
      yourCode:       'Your code:',
      noEmotion:      'Not registered',
      pending:        'pending',
      completedToday: 'completed today',
      entry:          'entry',
      entries:        'entries',
      partnerStatus:  'registered their mood',
    },

    // ── Check-in ─────────────────────────────────────────────────
    checkin: {
      selectEmotion: 'Select how you feel',
      linkFirst:     'Link your account with your partner first',
      saved:         'Status saved:',
      noLinked:      'NOT LINKED',
      linkPartner:   'Link your partner',
      notRegistered: 'Not registered yet',
    },

    // ── Emotions ─────────────────────────────────────────────────
    emotions: {
      happy:        { name: 'Happy',        support: 'Your joy also nourishes your partner. Share it with them today.' },
      inLove:       { name: 'In love',      support: 'Express it. Words and gestures are also romantic.' },
      excited:      { name: 'Excited',      support: 'Spread that energy! Tell your partner what has you feeling this way.' },
      peaceful:     { name: 'Peaceful',     support: 'Inner calm makes you more present for those you love.' },
      affectionate: { name: 'Affectionate', support: 'A hug or a small gesture today can make your partner\'s day.' },
      thoughtful:   { name: 'Thoughtful',   support: 'Sharing what\'s on your mind can clear things up.' },
      sad:          { name: 'Sad',          support: 'It\'s valid to feel this way. Do you want your partner to know?' },
      anxious:      { name: 'Anxious',      support: 'Anxiety passes. Breathe and share how you feel.' },
      angry:        { name: 'Angry',        support: 'It\'s okay to feel angry. Share it calmly when you can.' },
      exhausted:    { name: 'Exhausted',    support: 'You need rest. Your partner can support you.' },
      worried:      { name: 'Worried',      support: 'You\'re not alone. Sharing what worries you helps.' },
      grateful:     { name: 'Grateful',     support: 'Tell your partner something you appreciate about them today.' },
      mischievous:  { name: 'Mischievous',  support: 'That spark is energy to connect with your partner in a special way.' },
      overwhelmed:  { name: 'Overwhelmed',  support: 'Take it easy. One step at a time, and you don\'t have to do it alone.' },
      motivated:    { name: 'Motivated',    support: 'Use that energy for something that brings you closer as a couple.' },
    },

    // ── Reflection ───────────────────────────────────────────────
    reflection: {
      dateLabel:        'Question of the day',
      writeFirst:       'Write your reflection before saving',
      linkFirst:        'Link your partner to save reflections',
      noQuestion:       'No question available today',
      saved:            'Reflection saved ✓',
      saveError:        'Error saving',
      notAnsweredYet:   'hasn\'t answered yet',
      saveToSee:        'Save your reflection to see',
      reactionSaved:    'Reaction saved',
      reactionError:    'Error saving reaction',
      updateBtn:        'Update reflection',
    },

    // ── Capsules ─────────────────────────────────────────────────
    capsules: {
      cats: {
        gratitud:      'Gratitude',
        recuerdos:     'Memories',
        carta:         'Love letter',
        humor:         'Make me laugh',
        animo:         'Cheer up',
        cancion:       'Song',
        confesion:     'Confession',
        buenos_dias:   'Good morning',
        sin_categoria: 'Uncategorized',
      },
      tapToRecord:  'Tap to record',
      recording:    'Recording… tap to stop',
      micDenied:    'Microphone permission denied',
      micError:     'Could not access microphone',
      readyToSend:  'Recording ready — review before sending',
      linkFirst:    'You need a linked partner to send capsules',
      sent:         'Capsule sent ✓',
      recordNew:    'Record new',
    },

    // ── Tasks ────────────────────────────────────────────────────
    tasks: {
      noPending:        'No pending tasks!',
      noCompleted:      'No completed tasks yet',
      noCouple:         'No partner linked',
      noCoupleHint:     'Link your partner to manage tasks together',
      completed:        'Task completed! ✓',
      completeError:    'Error completing task',
      deleteError:      'Error deleting task',
      partnerCompleted: 'completed a task ✓',
      partnerAdded:     'added a task',
      assignedBoth:     'Both',
      assignedMe:       'Me',
      assignedTo:       'Assigned to:',
      completedBy:      'Completed by',
      at:               'at',
      priorityHigh:     'High',
      priorityMedium:   'Medium',
      priorityLow:      'Low',
      namePlaceholder:  'Task name...',
      newTask:          'New Task',
      priority:         'Priority',
      assignTo:         'Assign to',
      createTask:       'Create Task',
      partner:          'Partner',
    },

    // ── Roulette ─────────────────────────────────────────────────
    roulette: {
      noPlans:      'No plans for that combination. Try fewer filters.',
      closestPlan:  'No exact plans found, showing the closest match',
      dateBooked:   'Date booked! Enjoy it 🎉',
      linkFirst:    'Link your partner to save the date',
      dateSaved:    'Date saved! Enjoy it 🎉',
      dateSavedBtn: 'Date booked',
      dateSaveBtn2: 'Date saved',
      accept:       'Accept this date',
      saveError:    'Error saving date',
    },

    // ── Notes ────────────────────────────────────────────────────
    notes: {
      linkFirst:      'Link your partner to see the history',
      empty:          'No reflections saved yet.<br/>Answer the daily question to get started.',
      subtitle:       'entry',
      subtitlePl:     'entries',
      subtitleSuffix: '· last 30 days',
      loadError:      'Error loading history',
    },

    // ── Settings ─────────────────────────────────────────────────
    settings: {
      myProfile:        'My Profile',
      name:             'Name',
      edit:             'Edit',
      myPartner:        'My Partner',
      yourCode:         'Your code',
      copy:             'Copy',
      notifications:    'Notifications',
      dailyQuestion:    'Daily question',
      emotionalCheckin: 'Emotional check-in',
      audioCapsules:    'Audio capsules',
      preferences:      'Preferences',
      langLabel:        'Language',
      themeLabel:       'Theme',
      themeLight:       'Light',
      themeDark:        'Dark',
      themeSystem:      'System',
      account:          'Account',
      signOut:          'Sign out',
      deleteAccount:    'Delete account',
      nameTooShort:     'Name is too short',
      nameUpdated:      'Name updated ✓',
      nameError:        'Error updating name',
      photoUpdated:     'Photo updated ✓',
      photoError:       'Error uploading photo',
      codeLength:       'Enter a 6-character code',
      partnerLinked:    'Partner linked! 🎉',
      codeNotFound:     'Code not found',
      unlinkInfo:       'Contact support to unlink',
      langToastEs:      'Idioma: Español',
      langToastEn:      'Language set to English',
      themeToastDark:   '🌙 Dark mode on',
      themeToastLight:  '☀️ Light mode on',
      themeToastSystem: '🖥️ System theme',
      codeCopied:       'Code copied ✓',
      signOutError:     'Error signing out',
      deleteConfirm:    'Are you sure? Tap again to confirm',
      deleteInfo:       'To delete your account contact support@emotia.app',
    },

    // ── Router ───────────────────────────────────────────────────
    router: {
      loadError:    'Error loading screen',
      unknownError: 'Unknown error',
      retry:        'Retry',
    },
  },
};

/** Devuelve el idioma activo ('es' | 'en') */
export function getLang() {
  return localStorage.getItem('emotia_lang') || 'es';
}

/**
 * Traduce una clave punteada al idioma activo.
 * Ejemplo: t('checkin.selectEmotion')
 */
export function t(key) {
  const lang = getLang();
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.es;
  const keys = key.split('.');
  let val = dict;
  for (const k of keys) {
    if (val == null) return key;
    val = val[k];
  }
  return val ?? key;
}
