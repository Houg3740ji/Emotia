/**
 * EMOTIA — Cliente Supabase centralizado
 *
 * Este es el ÚNICO archivo donde se inicializa Supabase.
 * NUNCA crear otro cliente en ningún otro archivo del proyecto.
 * Importar siempre desde aquí: import { supabase, auth, db } from '../supabase.js'
 */

import { createClient } from '@supabase/supabase-js';

// Las variables vienen del archivo .env (inyectadas por Vite en build time)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Emotia] Faltan variables de entorno de Supabase. ' +
    'Asegúrate de que .env contiene VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  );
}

// ─────────────────────────────────────────────
// CLIENTE PRINCIPAL
// ─────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persiste la sesión en localStorage entre recargas y reinicios de app
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});


// ─────────────────────────────────────────────
// AUTH — Autenticación
// ─────────────────────────────────────────────
export const auth = {

  /**
   * Registro con email + contraseña.
   * Crea el usuario en auth.users y el trigger crea automáticamente
   * la fila en public.users con el nombre.
   */
  async signUp({ email, password, name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }, // se guarda en raw_user_meta_data → el trigger lo lee
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Login con email + contraseña.
   */
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Login con Google OAuth.
   * En Capacitor nativo, se abre el browser externo y redirige de vuelta.
   * Requiere configurar el deep link 'com.emotia.app://' en ambas plataformas.
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Login con Apple (solo iOS).
   * Requiere configurar Sign in with Apple en Apple Developer + Supabase.
   */
  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'com.emotia.app://auth/callback',
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Cierra la sesión del usuario actual.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Devuelve la sesión activa o null si no hay sesión.
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Devuelve el usuario autenticado actual o null.
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  /**
   * Suscripción a cambios de estado de autenticación.
   * Devuelve una función para cancelar la suscripción.
   * Uso: const { data: { subscription } } = auth.onAuthStateChange((event, session) => { ... })
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};


// ─────────────────────────────────────────────
// DB — Helpers de base de datos
// ─────────────────────────────────────────────
export const db = {

  // ── PERFIL DE USUARIO ──

  /**
   * Obtiene el perfil completo del usuario autenticado.
   */
  async getMyProfile() {
    const user = await auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza campos del perfil del usuario autenticado.
   * @param {Object} updates - campos a actualizar (name, avatar_url, etc.)
   */
  async updateMyProfile(updates) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── PAREJA ──

  /**
   * Obtiene la pareja del usuario con los perfiles de ambos miembros.
   * Devuelve null si el usuario no tiene pareja vinculada todavía.
   */
  async getMyCouple() {
    const user = await auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('couples')
      .select(`
        *,
        user1:users!couples_user1_id_fkey(id, name, avatar_url, partner_code),
        user2:users!couples_user2_id_fkey(id, name, avatar_url, partner_code)
      `)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .maybeSingle(); // maybeSingle() no lanza error si no hay resultado
    if (error) throw error;
    return data;
  },

  /**
   * Devuelve el perfil de la pareja (el otro usuario de la couple).
   */
  async getPartner() {
    const user = await auth.getUser();
    if (!user) return null;
    const couple = await db.getMyCouple();
    if (!couple) return null;
    const partnerId = couple.user1_id === user.id ? couple.user2_id : couple.user1_id;
    const { data, error } = await supabase
      .from('users')
      .select('id, name, avatar_url, partner_code')
      .eq('id', partnerId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Vincula dos usuarios como pareja usando el código de 6 caracteres.
   * El usuario que inicia es user1, el que acepta es user2.
   * @param {string} partnerCode - código de 6 caracteres de la pareja
   */
  async linkWithPartner(partnerCode) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');

    // Buscar al usuario con ese código
    const { data: partnerUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('partner_code', partnerCode.toUpperCase())
      .neq('id', user.id) // que no sea uno mismo
      .single();
    if (findError) throw new Error('Código de pareja no encontrado');

    // Crear la pareja
    const { data, error } = await supabase
      .from('couples')
      .insert({
        user1_id: user.id,
        user2_id: partnerUser.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza la fecha de aniversario de la pareja.
   */
  async updateAnniversary(coupleId, anniversaryDate) {
    const { data, error } = await supabase
      .from('couples')
      .update({ anniversary_date: anniversaryDate })
      .eq('id', coupleId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── CHECK-IN EMOCIONAL ──

  /**
   * Guarda o actualiza el check-in emocional del día actual.
   * Usa UPSERT para sobrescribir si ya registró hoy.
   */
  async saveEmotionCheckin({ coupleId, emoji, emotionName }) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('emotion_checkins')
      .upsert({
        user_id: user.id,
        couple_id: coupleId,
        emoji,
        emotion_name: emotionName,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      }, { onConflict: 'user_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Obtiene los check-ins de hoy para ambos miembros de la pareja.
   */
  async getTodayCheckins(coupleId) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('emotion_checkins')
      .select('*, user:users(name, avatar_url)')
      .eq('couple_id', coupleId)
      .eq('date', today);
    if (error) throw error;
    return data;
  },

  // ── PREGUNTA DEL DÍA ──

  /**
   * Obtiene la pregunta del día de forma determinista según la fecha.
   * Ambos miembros de la pareja verán siempre la misma pregunta el mismo día.
   * El seed es YYYYMMDD → índice estable mientras haya preguntas activas.
   */
  async getDailyQuestionForToday() {
    const { data, error } = await supabase
      .from('daily_questions')
      .select('id, text, text_en, category, is_active')
      .eq('is_active', true)
      .order('id');                          // orden estable
    if (error) throw error;
    if (!data?.length) return null;
    const seed = parseInt(
      new Date().toISOString().split('T')[0].replace(/-/g, ''), 10
    );
    return data[seed % data.length];
  },

  /**
   * Guarda la reacción emoji del usuario a la respuesta de su pareja.
   * Se almacena en la fila propia del usuario (reaction_emoji).
   */
  async saveReaction(questionId, reactionEmoji) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { error } = await supabase
      .from('question_answers')
      .update({ reaction_emoji: reactionEmoji })
      .eq('question_id', questionId)
      .eq('user_id', user.id);
    if (error) throw error;
  },

  /**
   * Guarda la respuesta a una pregunta del día.
   */
  async saveAnswer({ questionId, coupleId, answerText }) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('question_answers')
      .upsert({
        question_id: questionId,
        user_id: user.id,
        couple_id: coupleId,
        answer_text: answerText,
        answered_date: new Date().toISOString().split('T')[0],
      }, { onConflict: 'question_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Inserta una pregunta generada por IA en la tabla daily_questions.
   */
  async insertDailyQuestion({ text, category = 'emocional' }) {
    const { data, error } = await supabase
      .from('daily_questions')
      .insert({ text, category })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Obtiene las respuestas de ambos a una pregunta específica.
   */
  async getAnswersForQuestion(questionId, coupleId) {
    const { data, error } = await supabase
      .from('question_answers')
      .select('*, user:users(name, avatar_url)')
      .eq('question_id', questionId)
      .eq('couple_id', coupleId);
    if (error) throw error;
    return data;
  },

  /**
   * Historial de reflexiones de la pareja (últimas 30 fechas únicas).
   * Devuelve array agrupado por fecha: [{ date, question, answers: [{name, text}] }]
   */
  async getHistorialReflexiones(coupleId) {
    const { data, error } = await supabase
      .from('question_answers')
      .select(`
        answered_date,
        answer_text,
        user_id,
        daily_questions ( text ),
        users ( name )
      `)
      .eq('couple_id', coupleId)
      .order('answered_date', { ascending: false })
      .limit(60); // máx 2 respuestas/día × 30 días
    if (error) throw error;

    // Agrupar por fecha
    const byDate = {};
    for (const row of data || []) {
      const key = row.answered_date;
      if (!byDate[key]) {
        byDate[key] = {
          date:     key,
          question: row.daily_questions?.text || '',
          answers:  [],
        };
      }
      byDate[key].answers.push({
        name: row.users?.name || '—',
        text: row.answer_text || '',
      });
    }

    return Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  },

  // ── CÁPSULAS DE AUDIO ──

  /**
   * Guarda el registro de una cápsula de audio en la BD.
   * El audio ya debe estar subido a Storage antes de llamar esto.
   */
  async saveCapsule({ receiverId, coupleId, category, audioUrl, durationSeconds }) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('audio_capsules')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        couple_id: coupleId,
        category,
        audio_path: audioUrl,
        duration_seconds: durationSeconds,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Obtiene las cápsulas recibidas por el usuario actual.
   */
  async getReceivedCapsules() {
    const user = await auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('audio_capsules')
      .select('*, sender:users!audio_capsules_sender_id_fkey(name, avatar_url)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Obtiene una cápsula por ID con datos del remitente.
   */
  async getCapsuleById(capsuleId) {
    const { data, error } = await supabase
      .from('audio_capsules')
      .select('*, sender:users!audio_capsules_sender_id_fkey(name, avatar_url)')
      .eq('id', capsuleId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Marca una cápsula como leída.
   */
  async markCapsuleAsRead(capsuleId) {
    const { error } = await supabase
      .from('audio_capsules')
      .update({ is_read: true })
      .eq('id', capsuleId);
    if (error) throw error;
  },

  // ── TAREAS CONJUNTAS ──

  /**
   * Obtiene todas las tareas de la pareja.
   */
  async getTasks(coupleId) {
    const { data, error } = await supabase
      .from('couple_tasks')
      .select('*, assigned_to_user:users!couple_tasks_assigned_to_fkey(name, avatar_url)')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Crea una nueva tarea conjunta.
   */
  async createTask({ coupleId, title, priority = 'medium', assignedTo = null }) {
    const { data, error } = await supabase
      .from('couple_tasks')
      .insert({ couple_id: coupleId, title, priority, assigned_to: assignedTo })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Marca una tarea como completada.
   */
  async completeTask(taskId) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('couple_tasks')
      .update({
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Elimina una tarea.
   */
  async deleteTask(taskId) {
    const { error } = await supabase
      .from('couple_tasks')
      .delete()
      .eq('id', taskId);
    if (error) throw error;
  },

  // ── RULETA DE CITAS ──

  /**
   * Devuelve todos los planes de cita activos.
   * El filtrado por cost_type, mood_type y duration_label se hace
   * client-side en el caller para evitar que combinaciones AND vacíen el resultado.
   */
  async getDatePlans() {
    const { data, error } = await supabase
      .from('date_plans')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  /**
   * Inserta un plan de cita generado por IA en la tabla date_plans.
   */
  async insertDatePlan({ title, description, emoji, location_type, cost_type, mood_type }) {
    const { data, error } = await supabase
      .from('date_plans')
      .insert({ title, description, emoji, location_type, cost_type, mood_type })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Acepta un plan de cita (guarda en historial).
   */
  async acceptDatePlan(coupleId, datePlanId) {
    const { data, error } = await supabase
      .from('accepted_dates')
      .insert({ couple_id: coupleId, date_plan_id: datePlanId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── MODO ÍNTIMO — SWIPES ──

  /**
   * Obtiene las fantasías disponibles que el usuario aún no ha visto.
   */
  async getUnswiped(coupleId) {
    const user = await auth.getUser();
    if (!user) return [];
    // Obtener IDs ya vistos
    const { data: swipes } = await supabase
      .from('fantasy_swipes')
      .select('fantasy_id')
      .eq('user_id', user.id)
      .eq('couple_id', coupleId);
    const seenIds = (swipes || []).map(s => s.fantasy_id);

    // Obtener fantasías no vistas
    let query = supabase.from('fantasies').select('*').eq('is_active', true);
    if (seenIds.length > 0) query = query.not('id', 'in', `(${seenIds.join(',')})`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Guarda un swipe en una fantasía.
   * @param {string} direction - 'right' | 'left' | 'up'
   */
  async swipeFantasy(coupleId, fantasyId, direction) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('fantasy_swipes')
      .upsert({
        user_id: user.id,
        couple_id: coupleId,
        fantasy_id: fantasyId,
        direction,
      }, { onConflict: 'user_id,fantasy_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Inserta una fantasía generada por IA en la tabla fantasies.
   */
  async insertFantasy({ title, description, category, duration_label, intensity_label }) {
    const { data, error } = await supabase
      .from('fantasies')
      .insert({ title, description, category: category || 'general', duration_label, intensity_label })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Devuelve las fantasías donde ambos hicieron swipe right (matches).
   */
  async getMatches(coupleId) {
    const couple = await db.getMyCouple();
    if (!couple) return [];
    // Fantasías con swipe 'right' de ambos usuarios
    const { data, error } = await supabase
      .from('fantasy_swipes')
      .select('fantasy_id, user_id')
      .eq('couple_id', coupleId)
      .eq('direction', 'right');
    if (error) throw error;

    // Agrupar por fantasy_id y quedarse solo con las que tienen los 2 user_ids
    const countMap = {};
    data.forEach(({ fantasy_id, user_id }) => {
      if (!countMap[fantasy_id]) countMap[fantasy_id] = new Set();
      countMap[fantasy_id].add(user_id);
    });
    const matchIds = Object.entries(countMap)
      .filter(([, users]) => users.size === 2)
      .map(([id]) => id);

    if (matchIds.length === 0) return [];
    const { data: fantasies, error: err2 } = await supabase
      .from('fantasies')
      .select('*')
      .in('id', matchIds);
    if (err2) throw err2;
    return fantasies;
  },

  // ── TREGUA ──

  /**
   * Inicia una tregua (SOS).
   */
  async startTruce(coupleId) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('truces')
      .insert({
        couple_id: coupleId,
        initiated_by: user.id,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza el estado/fase de una tregua.
   */
  async updateTruce(truceId, updates) {
    const { data, error } = await supabase
      .from('truces')
      .update(updates)
      .eq('id', truceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── PREFERENCIAS ──

  /**
   * Obtiene las preferencias del usuario actual.
   */
  async getMyPreferences() {
    const user = await auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza las preferencias del usuario.
   */
  async updatePreferences(updates) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};


// ─────────────────────────────────────────────
// STORAGE — Subida de archivos
// ─────────────────────────────────────────────
export const storage = {

  /**
   * Sube una foto de perfil y devuelve la URL pública.
   * Ruta: avatars/{user_id}/avatar.{ext}
   */
  async uploadAvatar(file) {
    const user = await auth.getUser();
    if (!user) throw new Error('No autenticado');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Sube un audio de cápsula y devuelve { path, signedUrl }.
   * El path se guarda en la BD para poder generar URLs frescas al reproducir.
   * Detecta automáticamente el formato del blob (webm en browser, m4a en nativo).
   */
  async uploadAudio(coupleId, audioBlob) {
    const timestamp = Date.now();
    const mime = audioBlob.type || 'audio/webm';
    const ext  = mime.includes('webm') ? 'webm'
               : mime.includes('ogg')  ? 'ogg'
               : mime.includes('mp4')  ? 'mp4'
               : 'm4a';
    const path = `${coupleId}/${timestamp}.${ext}`;
    const { error } = await supabase.storage
      .from('audio-capsules')
      .upload(path, audioBlob, { contentType: mime });
    if (error) throw error;
    // URL firmada con 1 hora de expiración
    const { data, error: signError } = await supabase.storage
      .from('audio-capsules')
      .createSignedUrl(path, 3600);
    if (signError) throw signError;
    return { path, signedUrl: data.signedUrl };
  },

  /**
   * Renueva la URL firmada de un audio de cápsula.
   */
  async refreshAudioUrl(path) {
    const { data, error } = await supabase.storage
      .from('audio-capsules')
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
};

export default supabase;
