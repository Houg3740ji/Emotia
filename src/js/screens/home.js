/**
 * EMOTIA — Pantalla Home con datos reales de Supabase
 */

import { auth, db, supabase } from '../../supabase.js';
import { getTimeGreeting, showToast } from '../auth.js';
import { showSettings } from './secondary.js';
import { t, getLang } from '../i18n.js';

import homeRaw from '../../../stitch_emotia/home_inicio_1/code.html?raw';

const qs  = (sel) => document.querySelector(`#app ${sel}`);
const qsa = (sel) => document.querySelectorAll(`#app ${sel}`);

// ── Calcular racha de días consecutivos ──────────────────────
function _calcStreakFromDates(dates) {
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const dateStr of dates) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff > 1) break;
    streak++;
    cursor = d;
  }
  return streak;
}

async function calcEmotionStreak(userId, coupleId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('emotion_checkins')
      .select('date')
      .eq('user_id', userId)
      .eq('couple_id', coupleId)
      .order('date', { ascending: false })
      .limit(90);
    if (!data?.length) return { streak: 0, doneToday: false };
    const dates = [...new Set(data.map(r => r.date))];
    return { streak: _calcStreakFromDates(dates), doneToday: dates[0] === today };
  } catch (_) { return { streak: 0, doneToday: false }; }
}

async function calcQuestionStreak(userId, coupleId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('question_answers')
      .select('answered_date')
      .eq('user_id', userId)
      .eq('couple_id', coupleId)
      .order('answered_date', { ascending: false })
      .limit(90);
    if (!data?.length) return { streak: 0, doneToday: false };
    const dates = [...new Set(data.map(r => r.answered_date))];
    return { streak: _calcStreakFromDates(dates), doneToday: dates[0] === today };
  } catch (_) { return { streak: 0, doneToday: false }; }
}

// ── Renderizar barras mini de racha (5 barras) ────────────────
function renderMiniStreakBars(containerId, streak) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('div');
    bar.className = `h-0.5 flex-1 rounded-full ${i < streak ? 'bg-primary' : 'bg-white/10'}`;
    container.appendChild(bar);
  }
}

// ── Banner para usuario sin pareja vinculada ─────────────────
function insertNoCoupleBar(partnerCode) {
  const main = qs('main');
  if (!main) return;
  const banner = document.createElement('div');
  banner.className = 'widget-span-2 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between mb-2';
  banner.innerHTML = `
    <div>
      <p class="text-primary text-xs font-bold uppercase tracking-wide mb-0.5">${t('home.noCouple')}</p>
      <p class="text-slate-700 text-sm font-semibold">${t('home.yourCode')} <span class="text-primary font-black tracking-widest">${partnerCode || '---'}</span></p>
    </div>
    <button id="copy-home-code" class="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-full active:scale-95 transition-transform">
      <span class="material-symbols-outlined text-sm">content_copy</span>${t('copy')}
    </button>
  `;
  const grid = main.querySelector('.command-grid');
  if (grid) grid.before(banner);

  document.getElementById('copy-home-code')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(partnerCode || '');
      showToast(t('codeCopied'), 'success', 1500);
    } catch (_) {
      showToast(`${t('home.yourCode')} ${partnerCode}`, 'neutral', 3000);
    }
  });
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
async function initHome(router) {
  // ── 1. Obtener datos del usuario y su pareja ─────────────────
  const session = await auth.getSession().catch(() => null);
  const user    = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const profile = await db.getMyProfile().catch(() => null);
  const couple  = await db.getMyCouple().catch(() => null);
  const partner = couple ? await db.getPartner().catch(() => null) : null;

  // ── 2. Saludo dinámico ───────────────────────────────────────
  const h1 = qs('h1');
  if (h1 && profile?.name) {
    h1.innerHTML = getTimeGreeting(profile.name).replace(', ', ',<br/>');
  }

  // ── 3. Sin pareja → mostrar banner ──────────────────────────
  if (!couple) {
    insertNoCoupleBar(profile?.partner_code);
  }

  // ── 4. Widgets del grid ──────────────────────────────────────
  const widgets = qsa('.command-grid > div');
  // [0] = Emoción   [1] = Pregunta del día   [2] = Tareas   [3] = Racha   [4] = Notas

  // 4a. Emoción del día — siempre navega a /checkin al hacer click
  const emotionWidget = widgets[0];
  if (emotionWidget) {
    emotionWidget.style.cursor = 'pointer';
    emotionWidget.addEventListener('click', () => router.navigate('/checkin'));

    if (couple) {
      try {
        const checkins  = await db.getTodayCheckins(couple.id);
        const myCheckin = checkins.find(c => c.user_id === user.id);
        const emotionSpan = emotionWidget.querySelector('.text-3xl.font-black, span[class*="text-3xl"]');

        if (myCheckin) {
          if (emotionSpan) emotionSpan.textContent = myCheckin.emotion_name;
          const iconDiv = emotionWidget.querySelector('.material-symbols-outlined');
          if (iconDiv) iconDiv.textContent = myCheckin.emoji;
        } else {
          if (emotionSpan) emotionSpan.textContent = t('home.noEmotion');
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // 4b. Pregunta del día
  const questionCard  = widgets[1];
  if (questionCard) {
    try {
      const question = await db.getDailyQuestionForToday();
      const qText    = questionCard.querySelector('p.text-xl, p[class*="text-xl"]');
      if (qText && question) {
        qText.textContent = (getLang() === 'en' && question.text_en) ? question.text_en : question.text;
      }
      // Guardar el ID de la pregunta para la pantalla de reflexión
      if (question) sessionStorage.setItem('emotia_daily_question', JSON.stringify(question));

      // Click → navegar a reflexión
      questionCard.style.cursor = 'pointer';
      questionCard.addEventListener('click', () => router.navigate('/reflexion'));

      // También el botón "Escribe tu reflexión aquí"
      const reflBtn = questionCard.querySelector('button');
      reflBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        router.navigate('/reflexion');
      });
    } catch (_) { /* silencioso */ }
  }

  // 4c. Tareas — siempre navega a /tareas al hacer click
  const tasksWidget = widgets[2];
  if (tasksWidget) {
    tasksWidget.style.cursor = 'pointer';
    tasksWidget.addEventListener('click', () => router.navigate('/tareas'));

    if (couple) {
      try {
        const tasks     = await db.getTasks(couple.id);
        const pending   = tasks.filter(t => !t.completed_at);
        const todayDone = tasks.filter(t => {
          if (!t.completed_at) return false;
          const d = new Date(t.completed_at).toISOString().split('T')[0];
          return d === new Date().toISOString().split('T')[0];
        });
        const statusText = tasksWidget.querySelector('.text-white\\/40');
        if (statusText) {
          statusText.textContent = `${pending.length} ${t('home.pending')} • ${todayDone.length} ${t('home.completedToday')}`;
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // 4d. Rachas duales (emoción + pregunta del día)
  const rachaWidget = widgets[3];
  if (rachaWidget && couple) {
    try {
      const [emo, qst] = await Promise.all([
        calcEmotionStreak(user.id, couple.id),
        calcQuestionStreak(user.id, couple.id),
      ]);

      const eNum = rachaWidget.querySelector('#streak-emotion-num');
      if (eNum) eNum.textContent = String(emo.streak);
      const eDot = rachaWidget.querySelector('#streak-emotion-dot');
      if (eDot) eDot.className = `size-2 rounded-full ml-1 shrink-0 ${emo.doneToday ? 'bg-emerald-400' : 'bg-white/10'}`;
      renderMiniStreakBars('streak-emotion-bars', emo.streak);

      const qNum = rachaWidget.querySelector('#streak-question-num');
      if (qNum) qNum.textContent = String(qst.streak);
      const qDot = rachaWidget.querySelector('#streak-question-dot');
      if (qDot) qDot.className = `size-2 rounded-full ml-1 shrink-0 ${qst.doneToday ? 'bg-emerald-400' : 'bg-white/10'}`;
      renderMiniStreakBars('streak-question-bars', qst.streak);
    } catch (_) { /* silencioso */ }
  }

  // 4e. Notas guardadas → historial de reflexiones
  const notasWidget = widgets[4];
  if (notasWidget) {
    notasWidget.style.cursor = 'pointer';
    notasWidget.addEventListener('click', () => router.navigate('/notas'));

    if (couple) {
      try {
        const historial = await db.getHistorialReflexiones(couple.id);
        const countEl   = notasWidget.querySelector('.text-sm.font-bold');
        if (countEl) countEl.textContent = `${historial.length} ${historial.length !== 1 ? t('home.entries') : t('home.entry')}`;
      } catch (_) { /* silencioso */ }
    }
  }

  // ── 5. Wire up tab bar y botón de ajustes ────────────────────
  router.wireTabBar();

  const ajustesBtn = qs('button[class*="rounded-xl"][class*="bg-slate-100"]');
  ajustesBtn?.addEventListener('click', () => showSettings(router));

  // ── 6. Real-time: escuchar check-ins de la pareja ────────────
  if (couple) {
    const channel = supabase
      .channel(`home-checkins-${couple.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'emotion_checkins',
        filter: `couple_id=eq.${couple.id}`,
      }, (payload) => {
        // Si es la pareja quien registró, actualizar su widget
        if (payload.new?.user_id !== user.id) {
          const partnerCard = qs('.command-grid > div:nth-child(1)');
          if (partnerCard) {
            showToast(`${partner?.name || 'Tu pareja'} ${t('home.partnerStatus')} ${payload.new.emoji}`, 'neutral', 3000);
          }
        }
      })
      .subscribe();

    // Limpiar suscripción al salir
    window._emotiaChannel = channel;
  }
}

export const ROUTE_MAP = {
  '/home': { html: homeRaw, init: initHome },
};
