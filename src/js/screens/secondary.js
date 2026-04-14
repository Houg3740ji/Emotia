/**
 * EMOTIA — Pantallas secundarias (navegación básica)
 *
 * Reflexión, Cápsulas, Íntimo, Ruleta, Tareas.
 * En Fase 3 solo se conectan la navegación y el tab bar.
 * La lógica de Supabase se implementa en Fase 4.
 */

import { auth, db, supabase, storage } from '../../supabase.js';
import { showToast, setButtonLoading } from '../auth.js';
import { aiGenerate, buildContext } from '../ai.js';

import reflexionRaw from '../../../stitch_emotia/m_dulo_de_reflexi_n_refinado_v2/code.html?raw';
import capsulasRaw  from '../../../stitch_emotia/c_psulas_men_refinado_ios/code.html?raw';
import intimoRaw    from '../../../stitch_emotia/ntimo_descubrir_t_tulo_ajustado/code.html?raw';
import ruletaRaw    from '../../../stitch_emotia/ruleta_de_citas_men_refinado_ios/code.html?raw';
import tareasRaw    from '../../../stitch_emotia/tareas_conjuntas_refinado/code.html?raw';

const qs = (sel) => document.querySelector(`#app ${sel}`);

// ── Categorías de cápsulas (mismo orden que el grid Stitch) ──
const CAPSULE_CATS = [
  { key: 'gratitud',      emoji: '🙏', label: 'Gratitud'      },
  { key: 'recuerdos',     emoji: '📸', label: 'Recuerdos'     },
  { key: 'carta',         emoji: '💌', label: 'Carta de amor' },
  { key: 'humor',         emoji: '😂', label: 'Hazme reir'    },
  { key: 'animo',         emoji: '💪', label: 'Ánimo'         },
  { key: 'cancion',       emoji: '🎵', label: 'Canción'       },
  { key: 'confesion',     emoji: '🤫', label: 'Confesión'     },
  { key: 'buenos_dias',   emoji: '☀️', label: 'Buenos días'   },
  { key: 'sin_categoria', emoji: '📂', label: 'Sin categoría' },
];

// ── Mapa de prioridades de tareas ─────────────────────────────
const PRIORITY = {
  high:   { label: 'Alta',  bg: 'bg-red-100',   text: 'text-red-600'   },
  medium: { label: 'Media', bg: 'bg-amber-100',  text: 'text-amber-600' },
  low:    { label: 'Baja',  bg: 'bg-blue-100',   text: 'text-blue-600'  },
};

// ── Helper genérico: wire back button + tab bar ──────────────
function wireCommonNav(router) {
  // Botón atrás (todas las pantallas secundarias lo tienen)
  const backBtn = qs('button:has(.material-symbols-outlined)');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (router.currentRoute !== '/home') history.back();
      else router.navigate('/home');
    });
  }

  // Tab bar (si existe en la pantalla)
  router.wireTabBar();
}


// ════════════════════════════════════════════════════════════
// REFLEXIÓN
// ════════════════════════════════════════════════════════════
async function initReflexion(router) {
  // Back button
  qs('header button')?.addEventListener('click', () => history.back());

  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const couple  = await db.getMyCouple().catch(() => null);
  const partner = couple ? await db.getPartner().catch(() => null) : null;

  // ── Cargar pregunta del día (determinista — misma para ambos) ──
  let question = null;
  try {
    const cached = sessionStorage.getItem('emotia_daily_question');
    question = cached ? JSON.parse(cached) : await db.getDailyQuestionForToday();
    if (question && !cached) {
      sessionStorage.setItem('emotia_daily_question', JSON.stringify(question));
    }
  } catch (_) { /* silencioso */ }

  // ── Fallback IA: si no hay pregunta en BD, generamos una con Groq ──
  if (!question) {
    try {
      const ctx    = await buildContext(user, couple, partner);
      const result = await aiGenerate('daily_question', ctx);
      if (result?.question) {
        question = await db.insertDailyQuestion({ text: result.question, category: 'emocional' });
        sessionStorage.setItem('emotia_daily_question', JSON.stringify(question));
      }
    } catch (_) { /* silencioso — la UI mostrará el placeholder del HTML */ }
  }

  // ── Actualizar pregunta y fecha en el DOM ─────────────────────
  const questionEl = qs('h2.text-2xl');
  const dateLabel  = qs('p.text-slate-400.text-sm');
  if (questionEl && question?.text) questionEl.textContent = question.text;
  if (dateLabel) {
    const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    dateLabel.textContent = `Pregunta del día • ${hoy}`;
  }

  // ── Cargar respuestas existentes ──────────────────────────────
  let myAnswer      = null;
  let partnerAnswer = null;
  if (couple && question) {
    try {
      const answers = await db.getAnswersForQuestion(question.id, couple.id);
      myAnswer      = answers.find(a => a.user_id === user.id)  || null;
      partnerAnswer = answers.find(a => a.user_id !== user.id)  || null;
    } catch (_) { /* silencioso */ }
  }

  // ── Textarea + contador ───────────────────────────────────────
  const textarea = qs('textarea');
  const counter  = qs('.absolute.bottom-6.right-6');

  if (myAnswer?.answer_text && textarea) {
    textarea.value = myAnswer.answer_text;
    if (counter) counter.textContent = `${myAnswer.answer_text.length} / 500`;
  }

  textarea?.addEventListener('input', () => {
    if (textarea.value.length > 500) textarea.value = textarea.value.slice(0, 500);
    if (counter) counter.textContent = `${textarea.value.length} / 500`;
  });

  // ── Sección de respuesta de la pareja ─────────────────────────
  _renderPartnerSection(partner, partnerAnswer, !!myAnswer, question);

  // ── Botón guardar ─────────────────────────────────────────────
  const saveBtn = qs('button.bg-primary');
  if (saveBtn) {
    if (myAnswer) _setSaveBtnUpdate(saveBtn);

    saveBtn.addEventListener('click', async () => {
      const text = textarea?.value?.trim();
      if (!text) { showToast('Escribe tu reflexión antes de guardar', 'error'); return; }
      if (!couple) { showToast('Vincula tu pareja para guardar reflexiones', 'neutral', 3000); return; }
      if (!question) { showToast('No hay pregunta disponible hoy', 'error'); return; }

      setButtonLoading(saveBtn, true);
      try {
        await db.saveAnswer({ questionId: question.id, coupleId: couple.id, answerText: text });
        showToast('Reflexión guardada ✓', 'success', 2000);

        // Recargar respuestas para revelar la de la pareja si ya respondió
        const answers = await db.getAnswersForQuestion(question.id, couple.id);
        partnerAnswer = answers.find(a => a.user_id !== user.id) || null;
        myAnswer      = answers.find(a => a.user_id === user.id)  || null;

        _renderPartnerSection(partner, partnerAnswer, true, question);
        setButtonLoading(saveBtn, false);
        _setSaveBtnUpdate(saveBtn);
      } catch (err) {
        setButtonLoading(saveBtn, false);
        showToast(err.message || 'Error al guardar', 'error');
      }
    });
  }
}

function _setSaveBtnUpdate(btn) {
  btn.innerHTML = `
    <span class="text-lg">Actualizar reflexión</span>
    <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1">edit</span>
  `;
}

// ── Renderiza la sección de respuesta de la pareja ────────────
function _renderPartnerSection(partner, partnerAnswer, userHasAnswered, question) {
  // El placeholder de Stitch es el único div con gap-2 py-2 centrado
  const anchor = document.querySelector('#app .flex.items-center.justify-center.gap-2.py-2')
                 || document.getElementById('partner-section');
  if (!anchor) return;

  const partnerName = partner?.name || 'Tu pareja';

  if (!userHasAnswered) {
    // Bloqueado: respuesta simulada con blur + overlay
    anchor.outerHTML = `
      <div id="partner-section" class="relative rounded-2xl overflow-hidden">
        <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm
                    blur-sm select-none pointer-events-none">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            ${_esc(partnerName.toUpperCase())}
          </p>
          <p class="text-navy text-base leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit...
          </p>
          <div class="flex gap-3 mt-4 text-2xl">❤️ 😂 😮 🥺 🔥</div>
        </div>
        <div class="absolute inset-0 flex flex-col items-center justify-center
                    bg-white/70 backdrop-blur-[2px] rounded-2xl">
          <span class="material-symbols-outlined text-4xl text-slate-400 mb-2">lock</span>
          <p class="text-sm text-slate-500 font-medium text-center px-6">
            Guarda tu reflexión para ver la de ${_esc(partnerName)}
          </p>
        </div>
      </div>`;
    return;
  }

  if (!partnerAnswer) {
    // Usuario respondió, pareja no
    const el = document.getElementById('partner-section') || anchor;
    el.outerHTML = `
      <div id="partner-section" class="flex items-center justify-center gap-2 py-2">
        <span class="material-symbols-outlined text-slate-400 text-lg"
              style="font-variation-settings:'wght' 300">hourglass_empty</span>
        <p class="text-sm text-slate-400 font-medium italic">
          ${_esc(partnerName)} aún no ha respondido
        </p>
      </div>`;
    return;
  }

  // Pareja respondió → revelar con fade + reacciones
  const myReaction = partnerAnswer.reaction_emoji || null;
  const REACTIONS  = ['❤️', '😂', '😮', '🥺', '🔥'];
  const el = document.getElementById('partner-section') || anchor;

  el.outerHTML = `
    <div id="partner-section" class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm
                                     transition-opacity duration-500" style="opacity:0">
      <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
        ${_esc(partnerName.toUpperCase())}
      </p>
      <p class="text-navy text-base leading-relaxed">${_esc(partnerAnswer.answer_text)}</p>
      <div id="reaction-bar" class="flex gap-3 mt-5">
        ${REACTIONS.map(e => `
          <button data-reaction="${e}"
                  class="reaction-btn text-2xl transition-transform active:scale-90 rounded-full p-1
                         ${myReaction === e ? 'ring-2 ring-primary' : ''}">
            ${e}
          </button>`).join('')}
      </div>
    </div>`;

  // Fade-in
  requestAnimationFrame(() => {
    const card = document.getElementById('partner-section');
    if (card) card.style.opacity = '1';
  });

  // Wire reacciones
  document.querySelectorAll('#app #reaction-bar .reaction-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reaction = btn.dataset.reaction;
      if (!question) return;
      try {
        await db.saveReaction(question.id, reaction);
        document.querySelectorAll('#app #reaction-bar .reaction-btn').forEach(b => {
          b.classList.toggle('ring-2',     b === btn);
          b.classList.toggle('ring-primary', b === btn);
        });
        showToast(`Reacción guardada ${reaction}`, 'success', 1500);
      } catch (_) {
        showToast('Error al guardar reacción', 'error');
      }
    });
  });
}

function _esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ════════════════════════════════════════════════════════════
// CÁPSULAS — MENÚ
// ════════════════════════════════════════════════════════════
async function initCapsulas(router) {
  router.wireTabBar();

  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const couple = await db.getMyCouple().catch(() => null);

  // Cápsulas recibidas agrupadas por categoría
  const capsules = couple ? await db.getReceivedCapsules().catch(() => []) : [];

  const byKey     = {};   // { key: capsule[] }  ordenadas desc (API ya las trae así)
  const unreadByKey = {};  // { key: count }
  for (const cap of capsules) {
    const key = cap.category || 'sin_categoria';
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(cap);
    if (!cap.is_read) unreadByKey[key] = (unreadByKey[key] || 0) + 1;
  }

  // Wire category cards
  const cards = document.querySelectorAll('#app .grid.grid-cols-3 > div');
  cards.forEach((card, i) => {
    const cat = CAPSULE_CATS[i];
    if (!cat) return;

    // Badge de no leídas
    const unread = unreadByKey[cat.key] || 0;
    if (unread > 0) {
      card.style.position = 'relative';
      const badge = document.createElement('span');
      badge.className = 'absolute -top-1.5 -right-1.5 bg-red-500 text-white '
                      + 'text-[9px] font-bold rounded-full min-w-[18px] h-[18px] '
                      + 'flex items-center justify-center px-1 shadow';
      badge.textContent = unread > 9 ? '9+' : unread;
      card.appendChild(badge);
    } else if ((byKey[cat.key] || []).length > 0) {
      // Hay cápsulas pero todas leídas → badge gris discreto
      card.style.position = 'relative';
      const badge = document.createElement('span');
      badge.className = 'absolute -top-1.5 -right-1.5 bg-slate-400 text-white '
                      + 'text-[9px] font-bold rounded-full min-w-[18px] h-[18px] '
                      + 'flex items-center justify-center px-1 shadow';
      badge.textContent = (byKey[cat.key] || []).length > 9 ? '9+' : (byKey[cat.key] || []).length;
      card.appendChild(badge);
    }

    card.style.cursor = 'pointer';
    card.classList.add('active:scale-95', 'transition-transform');

    card.addEventListener('click', () => {
      const catCapsules = byKey[cat.key] || [];
      if (catCapsules.length > 0) {
        _showCapsulaListSheet(cat, catCapsules, router);
      } else {
        router.navigate('/capsulas/grabar', { category: cat.key });
      }
    });
  });
}

// ── Bottom sheet: lista de cápsulas de una categoría ─────────
function _showCapsulaListSheet(cat, capsules, router) {
  const modal = document.createElement('div');
  modal.id = 'capsula-list-modal';
  modal.className = 'fixed inset-0 z-50 flex items-end';

  const rows = capsules.map(cap => {
    const senderName = cap.sender?.name || 'Tu pareja';
    const senderAv   = cap.sender?.avatar_url;
    const dur        = _fmtSecs(cap.duration_seconds || 0);
    const dateStr    = cap.created_at
      ? new Date(cap.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : '';
    const isUnread   = !cap.is_read;

    return `
      <button class="cap-row w-full flex items-center gap-4 p-4 rounded-2xl
                     bg-slate-50 hover:bg-slate-100 active:scale-[0.98]
                     transition-all border ${isUnread ? 'border-primary/20' : 'border-transparent'}"
              data-cap-id="${cap.id}">
        <div class="w-11 h-11 rounded-full overflow-hidden bg-primary/10
                    flex items-center justify-center flex-shrink-0">
          ${senderAv
            ? `<img src="${_esc(senderAv)}" class="w-full h-full object-cover" alt="${_esc(senderName)}">`
            : `<span class="material-symbols-outlined text-xl text-primary/40"
                     style="font-variation-settings:'FILL' 1">person</span>`}
        </div>
        <div class="flex-1 text-left min-w-0">
          <p class="font-semibold text-slate-800 text-sm truncate">${_esc(senderName)}</p>
          <p class="text-xs text-slate-400">${_esc(dur)} · ${_esc(dateStr)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${isUnread
            ? `<span class="w-2.5 h-2.5 rounded-full bg-primary block"></span>`
            : `<span class="material-symbols-outlined text-slate-300 text-lg">check_circle</span>`}
          <span class="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
        </div>
      </button>`;
  }).join('');

  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="clm-backdrop"></div>
    <div id="clm-sheet"
         class="relative w-full bg-white rounded-t-3xl pb-10 shadow-2xl
                translate-y-full transition-transform duration-300 max-h-[80vh] flex flex-col">
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-slate-200 rounded-full"></div>
      </div>

      <!-- Cabecera -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${cat.emoji}</span>
          <h3 class="text-lg font-bold text-slate-900">${_esc(cat.label)}</h3>
          <span class="text-xs text-slate-400 font-medium">${capsules.length} cápsula${capsules.length !== 1 ? 's' : ''}</span>
        </div>
        <button id="clm-close" class="text-slate-400 active:scale-90 transition-transform p-1">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Lista scrollable -->
      <div class="overflow-y-auto flex-1 px-4 py-3 space-y-2">
        ${rows}
      </div>

      <!-- Botón grabar nueva en esta categoría -->
      <div class="px-4 pt-3">
        <button id="clm-record-btn"
                class="w-full bg-primary text-white font-bold py-4 rounded-full
                       active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style="background:#14213D">
          <span class="material-symbols-outlined text-xl"
                style="font-variation-settings:'FILL' 1">mic</span>
          <span>Grabar nueva ${_esc(cat.label)}</span>
        </button>
      </div>
    </div>`;

  document.getElementById('app').appendChild(modal);

  // Animación entrada
  requestAnimationFrame(() => {
    document.getElementById('clm-sheet')?.classList.remove('translate-y-full');
  });

  const closeModal = () => {
    const sheet = document.getElementById('clm-sheet');
    if (sheet) {
      sheet.classList.add('translate-y-full');
      setTimeout(() => modal.remove(), 300);
    } else {
      modal.remove();
    }
  };

  document.getElementById('clm-close')   ?.addEventListener('click', closeModal);
  document.getElementById('clm-backdrop')?.addEventListener('click', closeModal);

  // Grabar nueva cápsula en esta categoría
  document.getElementById('clm-record-btn')?.addEventListener('click', () => {
    modal.remove();
    router.navigate('/capsulas/grabar', { category: cat.key });
  });

  // Tap en fila de cápsula → reproducir
  modal.querySelectorAll('.cap-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const capId  = btn.dataset.capId;
      const capObj = capsules.find(c => String(c.id) === String(capId));
      if (!capObj) return;
      modal.remove();
      router.navigate('/capsulas/reproducir', { capsule: capObj });
    });
  });
}


// ════════════════════════════════════════════════════════════
// MODO ÍNTIMO
// ════════════════════════════════════════════════════════════
async function initIntimo(router) {
  const app  = document.getElementById('app');
  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const couple = await db.getMyCouple().catch(() => null);

  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#F5F0E8] font-display text-slate-900">

      <header class="pt-12 pb-2 px-6 flex items-center justify-center sticky top-0 z-10
                     bg-[#F5F0E8]/90 backdrop-blur-md">
        <h1 class="font-bold tracking-tight text-4xl text-slate-900">Íntimo</h1>
      </header>

      <!-- Tabs -->
      <div class="px-6 py-4">
        <div class="flex h-11 items-center rounded-xl bg-slate-200/50 p-1 max-w-sm mx-auto">
          ${['descubrir','matches','historial'].map((t, i) => `
            <button data-tab="${t}"
                    class="intimo-tab flex-1 h-full rounded-lg text-sm font-semibold
                           transition-all duration-200
                           ${i === 0 ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}">
              ${t.charAt(0).toUpperCase() + t.slice(1)}
            </button>`).join('')}
        </div>
      </div>

      <!-- Contenido de tab -->
      <div id="intimo-content" class="flex-1 flex flex-col overflow-hidden pb-36"></div>

      <!-- Nav fija -->
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 z-30">
        <nav class="bg-white rounded-full py-2 px-4 flex items-center justify-between h-16"
             style="box-shadow:0 10px 40px -10px rgba(0,0,0,.12)">
          <a data-nav="/home" class="flex flex-1 items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-slate-400 text-3xl">home</span>
          </a>
          <a data-nav="/capsulas" class="flex flex-1 items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-slate-400 text-3xl">checklist</span>
          </a>
          <div class="px-2">
            <button class="w-12 h-12 rounded-full flex items-center justify-center
                           text-white active:scale-95 transition-transform"
                    style="background:#0D9488;box-shadow:0 4px 12px rgba(13,148,136,.3)">
              <span class="material-symbols-outlined text-3xl">add</span>
            </button>
          </div>
          <a data-nav="/intimo" class="flex flex-1 items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-3xl"
                  style="color:#0D9488;font-variation-settings:'FILL' 1">auto_awesome</span>
          </a>
          <a data-nav="/ruleta" class="flex flex-1 items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-slate-400 text-3xl">person</span>
          </a>
        </nav>
      </div>
    </div>`;

  window.tailwind?.refresh?.();

  // Nav
  document.querySelectorAll('#app [data-nav]').forEach(el =>
    el.addEventListener('click', () => router.navigate(el.dataset.nav))
  );

  // Tab switching
  const switchTab = async (tab) => {
    document.querySelectorAll('#app .intimo-tab').forEach(btn => {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle('bg-white',      on);
      btn.classList.toggle('shadow-sm',     on);
      btn.classList.toggle('text-primary',  on);
      btn.classList.toggle('text-slate-500', !on);
    });
    const content = document.getElementById('intimo-content');
    if (!content) return;
    content.innerHTML = `
      <div class="flex-1 flex items-center justify-center py-20">
        <span class="material-symbols-outlined text-slate-300 text-4xl animate-spin">
          progress_activity
        </span>
      </div>`;
    if (tab === 'descubrir')    await _intimoDescubrir(content, couple, user);
    else if (tab === 'matches') await _intimoMatches(content, couple);
    else                        await _intimoHistorial(content, couple);
  };

  document.querySelectorAll('#app .intimo-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  await switchTab('descubrir');
}

// ── LocalStorage: IDs vistos (TTL 7 días) ────────────────────
const _SEEN_KEY = 'emotia_seen_fantasies';
function _getSeenMap() {
  try {
    const raw = localStorage.getItem(_SEEN_KEY);
    if (!raw) return {};
    const map    = JSON.parse(raw);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return Object.fromEntries(Object.entries(map).filter(([, ts]) => ts > cutoff));
  } catch { return {}; }
}
function _markSeenId(id) {
  try {
    const map = _getSeenMap();
    map[String(id)] = Date.now();
    localStorage.setItem(_SEEN_KEY, JSON.stringify(map));
  } catch {}
}

// ── Fantasías de respaldo cuando BD devuelve vacío ────────────
const FALLBACK_FANTASIES = [
  // SENSORIAL
  { id: 'fb-1',  title: 'Venda y sorpresa total',       description: 'Un@ lleva los ojos vendados. El otro guía cada toque durante 20 minutos sin hablar ni revelar qué viene después.', category: 'sensorial', intensity_label: 'medio',   duration_label: '20 min' },
  { id: 'fb-2',  title: 'Hielo y aceite caliente',      description: 'Alternad cubitos de hielo y aceite templado sobre la piel. Quien recibe cierra los ojos y no sabe qué viene.', category: 'sensorial', intensity_label: 'medio',   duration_label: '30 min' },
  { id: 'fb-3',  title: 'Solo con una pluma',           description: 'Diez minutos de exploración solo con una pluma de marabú. Sin manos, sin hablar. Turnaos sin límite de tiempo.', category: 'sensorial', intensity_label: 'suave',   duration_label: '20 min' },
  { id: 'fb-4',  title: 'Masaje con vela de masaje',    description: 'Gotead cera de vela de masaje de baja temperatura y masajead la zona después. Veinte minutos cada uno.', category: 'sensorial', intensity_label: 'medio',   duration_label: '45 min' },
  { id: 'fb-5',  title: 'Masaje facial lento',          description: 'Diez minutos de masaje facial cada uno: sienes, mandíbula, cuero cabelludo. Sin prisa. Sorprende la intimidad que genera.', category: 'sensorial', intensity_label: 'suave',   duration_label: '20 min' },
  // ROLE PLAY
  { id: 'fb-6',  title: 'Extraños en el bar',           description: 'Quedadais en un bar y fingid que no os conocéis. Ligaros desde cero como si fuera la primera vez que os veis.', category: 'role_play', intensity_label: 'medio',   duration_label: '2 h'   },
  { id: 'fb-7',  title: 'Servicio a habitación',        description: 'Un@ hace un pedido por teléfono. El otro llega como camarero del hotel. Toda la noche en personaje sin romperlo en ningún momento.', category: 'role_play', intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-8',  title: 'Masajista de lujo',            description: 'Un@ es clienta de spa exclusivo, el otro el masajista profesional. Mesa, aceite, música ambient. Sin salir del personaje.', category: 'role_play', intensity_label: 'suave',   duration_label: '45 min' },
  { id: 'fb-9',  title: 'Vecinos que se lían',          description: 'Un@ llama a la puerta con cualquier excusa. El otro abre. Fingid que os veis por primera vez y dejadlo fluir.', category: 'role_play', intensity_label: 'intenso', duration_label: '1 h'   },
  // JUEGO
  { id: 'fb-10', title: 'Ruleta de deseos secretos',    description: 'Cada uno escribe 6 deseos en papeles doblados. Mezcladlos. Lo que salga al azar se cumple esa noche, sin negociar.', category: 'juego',    intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-11', title: 'Verdad o reto íntimo',         description: 'Por turnos: verdad es confesar una fantasía nunca dicha. Reto es que el otro decida qué hacéis exactamente durante tres minutos.', category: 'juego',    intensity_label: 'medio',   duration_label: '45 min' },
  { id: 'fb-12', title: 'Strip trivial',                description: 'Preguntas de cultura general. Cada error: una prenda menos. El perdedor final cumple un deseo del ganador sin límites.', category: 'juego',    intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-13', title: 'Dados de instrucciones',       description: 'Cada uno escribe 6 instrucciones numeradas del 1 al 6. Tirad un dado por turnos y cumplidlas sin negociar ni pedir cambios.', category: 'juego',    intensity_label: 'intenso', duration_label: '45 min' },
  // AVENTURA
  { id: 'fb-14', title: 'Fuera de la cama esta noche',  description: 'Ningún espacio habitual esta noche. Elegid juntos dónde, pero tiene que ser un lugar nuevo: cocina, terraza o donde sea.', category: 'aventura',  intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-15', title: 'En el coche de noche',         description: 'Aparcamiento solitario, asientos reclinados, música baja. Como cuando erais jóvenes y no teníais otro sitio adonde ir.', category: 'aventura',  intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-16', title: 'Terraza a medianoche',         description: 'Solo vosotros, la oscuridad y las estrellas. Llevar una manta. Sin planear nada más. Improvisar el resto.', category: 'aventura',  intensity_label: 'intenso', duration_label: '45 min' },
  { id: 'fb-17', title: 'Hotel de improviso',           description: 'Reservad esta noche un hotel cercano. Nada planeado más allá de eso. Los móviles en silencio nada más entrar.', category: 'aventura',  intensity_label: 'medio',   duration_label: '12 h'  },
  // CONEXIÓN
  { id: 'fb-18', title: '4 minutos mirándoos',          description: 'Sentaos frente a frente, sin hablar ni reír. Solo miraros a los ojos cuatro minutos exactos. Es más íntimo de lo que parece.', category: 'conexion',  intensity_label: 'suave',   duration_label: '15 min' },
  { id: 'fb-19', title: 'Carta erótica en papel',       description: 'Cada uno escribe en papel lo que desea del otro esta noche. Intercambiad las cartas. Cumplidlas en el orden que salgan.', category: 'conexion',  intensity_label: 'medio',   duration_label: '1 h'   },
  { id: 'fb-20', title: 'Bailar pegados en silencio',   description: 'Abrazados en el salón, sin música. Uno lleva, el otro sigue. Diez minutos sin hablar ni mirar el teléfono.', category: 'conexion',  intensity_label: 'suave',   duration_label: '15 min' },
  { id: 'fb-21', title: 'Preguntas que no hacemos',     description: 'Por turnos, haced preguntas íntimas que nunca os habéis atrevido a hacer. La regla: respuesta honesta obligatoria siempre.', category: 'conexion',  intensity_label: 'medio',   duration_label: '1 h'   },
  // DESAFÍO
  { id: 'fb-22', title: 'Solo palabras, una hora',      description: 'Sin contacto físico durante 60 minutos. Solo describid con palabras exactas lo que queréis haceros. La tensión acumulada es el juego.', category: 'desafio',   intensity_label: 'intenso', duration_label: '1 h'   },
  { id: 'fb-23', title: 'Fotos íntimas solo vuestras',  description: 'Turnaos haciéndoos fotos el uno al otro. El fotógrafo decide la pose sin que el otro la vea venir. Las fotos son solo vuestras.', category: 'desafio',   intensity_label: 'intenso', duration_label: '45 min' },
  { id: 'fb-24', title: 'Striptease planificado',       description: 'Un@ prepara una playlist y ejecuta un striptease. El otro solo puede mirar, sin tocar, hasta que quien actúa lo autorice.', category: 'desafio',   intensity_label: 'intenso', duration_label: '20 min' },
  { id: 'fb-25', title: 'Confesión nunca dicha',        description: 'Por turnos, confesad una fantasía que nunca habéis dicho en voz alta. Sin juzgar, sin comentar. Solo escuchar y aceptar.', category: 'desafio',   intensity_label: 'intenso', duration_label: '30 min' },
  // ROMÁNTICO
  { id: 'fb-26', title: 'Baño de espuma y champán',     description: 'Llenad la bañera con espuma y sales. Champán, velas y música. Sin salir hasta que se vacíe la botella.', category: 'romantico', intensity_label: 'suave',   duration_label: '1 h'   },
  { id: 'fb-27', title: 'Cena a oscuras con velas',     description: 'Cenad solo con velas, sin luz artificial. Sin móviles. Solo hablar de recuerdos favoritos que tenéis juntos.', category: 'romantico', intensity_label: 'suave',   duration_label: '1 h'   },
  { id: 'fb-28', title: 'Leer erótica en voz alta',     description: 'Buscad un relato erótico y leedlo por párrafos alternos en voz alta. Quien escucha no puede interrumpir ni tocar.', category: 'romantico', intensity_label: 'medio',   duration_label: '30 min' },
  { id: 'fb-29', title: 'Playlist íntima compartida',   description: 'Cada uno añade 10 canciones a una playlist nueva. Escuchadla juntos en silencio sin explicar por qué elegisteis cada una.', category: 'romantico', intensity_label: 'suave',   duration_label: '45 min' },
  { id: 'fb-30', title: 'Sin ropa en casa toda la tarde', description: 'Pasad toda la tarde en casa sin ropa, haciendo cosas normales: cocinar, ver algo, hablar. Sin que sea obligatorio nada más.', category: 'desafio',   intensity_label: 'medio',   duration_label: '3 h'   },
];

// ── Tab: Descubrir ────────────────────────────────────────────
async function _intimoDescubrir(container, couple, user) {
  if (!couple) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-20">
        <span class="text-5xl">💫</span>
        <p class="font-bold text-lg text-slate-700">Sin pareja vinculada</p>
        <p class="text-sm text-slate-400">Vincula a tu pareja para explorar juntos</p>
      </div>`;
    return;
  }

  // Excluir IDs ya vistos en localStorage (TTL 7 días)
  const seenIds = Object.keys(_getSeenMap());

  let fantasies = [];
  try {
    let all = await db.getUnswiped(couple.id);
    if (seenIds.length > 0) all = all.filter(f => !seenIds.includes(String(f.id)));
    // Si la BD devuelve vacío, usar fallbacks hardcodeados (también filtrando ya vistos)
    if (!all.length) {
      all = FALLBACK_FANTASIES.filter(f => !seenIds.includes(String(f.id)));
    }
    fantasies = all;
  } catch (_) {
    fantasies = FALLBACK_FANTASIES.filter(f => !seenIds.includes(String(f.id)));
  }

  const state = { index: 0, aiLoading: false, aiFailed: false };

  // Generación IA en segundo plano
  async function _triggerAI() {
    if (state.aiLoading) return;
    state.aiLoading = true;
    state.aiFailed  = false;
    // Capturar ANTES de las llamadas async si el usuario ya llegó al final
    const wasAtEnd = state.index >= fantasies.length;
    try {
      const partner = await db.getPartner().catch(() => null);
      const ctx     = await buildContext(user, couple, partner);
      const aiResult = await Promise.race([
        aiGenerate('fantasy', ctx).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
      if (aiResult) {
        if (!aiResult.intensity_label) aiResult.intensity_label = 'suave';
        if (!aiResult.category)        aiResult.category        = 'romantico';
        fantasies.push({ ...aiResult, id: `ai-${Date.now()}`, _isAI: true });
      } else {
        state.aiFailed = true;
      }
    } catch (_) {
      state.aiFailed = true;
    } finally {
      state.aiLoading = false;
      // Siempre re-renderizar si el usuario estaba esperando al final del stack
      if (wasAtEnd) renderStack();
    }
  }

  function renderStack() {
    // Disparar IA en segundo plano cuando queden ≤ 3 cartas
    const remaining = fantasies.length - state.index;
    if (remaining <= 3 && !state.aiLoading && !state.aiFailed) {
      _triggerAI();
    }

    // Sin más cartas en el array
    if (state.index >= fantasies.length) {
      if (state.aiLoading) {
        container.innerHTML = `
          <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-20">
            <span class="material-symbols-outlined text-primary text-4xl animate-spin">
              progress_activity
            </span>
            <p class="text-sm text-slate-500 font-medium">Cargando más ideas...</p>
          </div>`;
      } else {
        container.innerHTML = `
          <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-16">
            <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <span class="text-4xl">✨</span>
            </div>
            <p class="font-bold text-lg text-slate-700">Has visto todo</p>
            <p class="text-sm text-slate-400">Vuelve más tarde o revisa tus matches</p>
            <button id="go-matches"
                    class="mt-2 px-6 py-3 rounded-full font-semibold text-sm text-slate-600
                           border border-slate-200 active:scale-95 transition-transform">
              Ver Matches
            </button>
          </div>`;
        document.getElementById('go-matches')?.addEventListener('click', () =>
          document.querySelector('#app .intimo-tab[data-tab="matches"]')?.click()
        );
      }
      return;
    }

    const cur  = fantasies[state.index];
    const next = fantasies[state.index + 1];

    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center px-6">

        <!-- Stack de cartas -->
        <div class="relative w-full max-w-sm" style="aspect-ratio:3/4">

          ${next ? `
          <div class="absolute inset-0 bg-white/50 rounded-3xl translate-y-4 scale-[0.94] -z-10
                      border border-slate-100"
               style="box-shadow:0 4px 12px rgba(0,0,0,.04)"></div>` : ''}

          <div id="swipe-card"
               class="w-full h-full bg-white rounded-3xl overflow-hidden flex flex-col
                      border border-slate-100 select-none touch-none"
               style="will-change:transform;
                      box-shadow:0 20px 25px -5px rgba(0,0,0,.06),0 10px 10px -5px rgba(0,0,0,.02)">

            <!-- Imagen / fondo -->
            <div class="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200"
                 style="flex:1.4">
              ${cur.image_url
                ? `<img src="${_esc(cur.image_url)}" class="w-full h-full object-cover absolute inset-0"
                        alt="${_esc(cur.title)}" onerror="this.style.display='none'">`
                : ''}
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span class="text-[90px] opacity-20 select-none">${_fantasyEmoji(cur.category)}</span>
              </div>
              <div class="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent"></div>

              <!-- Indicadores de swipe -->
              <div id="ind-like" class="absolute top-8 left-6 opacity-0 pointer-events-none">
                <span class="font-black text-lg px-4 py-2 rounded-xl border-[3px] border-green-500
                             text-green-600 bg-white/90 rotate-[-12deg] inline-block shadow">
                  ME GUSTA
                </span>
              </div>
              <div id="ind-nope" class="absolute top-8 right-6 opacity-0 pointer-events-none">
                <span class="font-black text-lg px-4 py-2 rounded-xl border-[3px] border-red-500
                             text-red-600 bg-white/90 rotate-[12deg] inline-block shadow">
                  PASO
                </span>
              </div>

              <!-- Título en la imagen -->
              <div class="absolute bottom-5 left-5 right-5">
                ${cur.category ? `
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-white/85
                             text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
                  ${_esc(_categoryLabel(cur.category))}
                </span>` : ''}
                <h2 class="text-2xl font-bold text-slate-900 leading-tight">
                  ${_esc(cur.title || '')}
                </h2>
              </div>
            </div>

            <!-- Descripción -->
            <div class="px-5 py-4">
              <p class="text-slate-500 text-sm leading-relaxed line-clamp-2">
                ${_esc(cur.description || '')}
              </p>
              <div class="mt-3 flex items-center gap-2 flex-wrap">
                ${cur.duration_label ? `
                <span class="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 rounded-full
                             text-xs font-medium text-slate-600">
                  <span class="material-symbols-outlined text-sm text-slate-400">timer</span>
                  ${_esc(cur.duration_label)}
                </span>` : ''}
                ${cur.intensity_label ? `
                <span class="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 rounded-full
                             text-xs font-medium text-slate-600">
                  <span class="material-symbols-outlined text-sm text-slate-400">bolt</span>
                  ${_esc(cur.intensity_label)}
                </span>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex items-center gap-8 mt-8">
          <button id="btn-discard"
                  class="w-16 h-16 rounded-full bg-white border border-slate-100 shadow-lg
                         flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-4xl"
                  style="color:#FF4B4B;font-variation-settings:'FILL' 1">close</span>
          </button>
          <button id="btn-info"
                  class="w-12 h-12 rounded-full bg-white border border-slate-100 shadow-md
                         flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-slate-400 text-2xl">info</span>
          </button>
          <button id="btn-like"
                  class="w-16 h-16 rounded-full bg-white border border-slate-100 shadow-lg
                         flex items-center justify-center active:scale-90 transition-transform">
            <span class="material-symbols-outlined text-4xl"
                  style="color:#2DCE89;font-variation-settings:'FILL' 1">favorite</span>
          </button>
        </div>
      </div>`;

    const doDiscard = () => _animateCardOut('left',  () => _recordSwipe('left',  cur, couple, state, renderStack));
    const doLike    = () => _animateCardOut('right', () => _recordSwipe('right', cur, couple, state, renderStack));

    _wireSwipe(document.getElementById('swipe-card'), { onLike: doLike, onDiscard: doDiscard });
    document.getElementById('btn-discard')?.addEventListener('click', doDiscard);
    document.getElementById('btn-like')   ?.addEventListener('click', doLike);
    document.getElementById('btn-info')   ?.addEventListener('click', () => _showFantasySheet(cur));
  }

  renderStack();
}

// ── Tab: Matches ──────────────────────────────────────────────
async function _intimoMatches(container, couple) {
  if (!couple) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-20">
        <p class="text-slate-400 text-sm">Vincula tu pareja para ver matches</p>
      </div>`;
    return;
  }

  let matches = [];
  try { matches = await db.getMatches(couple.id); } catch (_) {}

  if (!matches.length) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-16">
        <span class="text-5xl">💫</span>
        <p class="font-bold text-lg text-slate-700">Sin matches todavía</p>
        <p class="text-sm text-slate-400">Cuando ambos deseen lo mismo aparecerá aquí</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="px-5 py-3">
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[.15em] mb-4">
        ${matches.length} match${matches.length !== 1 ? 'es' : ''} en común
      </p>
      <div class="grid grid-cols-2 gap-3">
        ${matches.map(f => `
          <div class="match-card bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm
                      active:scale-95 transition-transform cursor-pointer"
               data-fid="${f.id}">
            <div class="relative bg-gradient-to-br from-primary/5 to-primary/15
                        flex items-center justify-center overflow-hidden"
                 style="aspect-ratio:4/3">
              ${f.image_url
                ? `<img src="${_esc(f.image_url)}" class="w-full h-full object-cover absolute inset-0"
                        onerror="this.style.display='none'">`
                : ''}
              <span class="text-4xl opacity-30 relative z-10 select-none">
                ${_fantasyEmoji(f.category)}
              </span>
              <span class="absolute top-2 right-2 bg-green-500 text-white text-[9px]
                           font-bold px-2 py-0.5 rounded-full z-20">
                Match
              </span>
            </div>
            <div class="p-3">
              <p class="font-bold text-sm text-slate-800 leading-snug line-clamp-2">
                ${_esc(f.title || '')}
              </p>
              ${f.intensity_label
                ? `<p class="text-[11px] text-slate-400 mt-0.5">${_esc(f.intensity_label)}</p>`
                : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('click', () => {
      const f = matches.find(m => String(m.id) === card.dataset.fid);
      if (f) _showFantasySheet(f);
    });
  });
}

// ── Tab: Historial ────────────────────────────────────────────
async function _intimoHistorial(container, couple) {
  if (!couple) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-20">
        <p class="text-slate-400 text-sm">Vincula tu pareja para ver el historial</p>
      </div>`;
    return;
  }

  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="flex-1 flex items-center justify-center py-12">
      <span class="material-symbols-outlined text-slate-300 text-4xl animate-spin">
        progress_activity
      </span>
    </div>`;

  try {
    // Mis swipes right
    const { data: mySwipes, error: e1 } = await supabase
      .from('fantasy_swipes')
      .select('fantasy_id, created_at')
      .eq('user_id', user.id)
      .eq('couple_id', couple.id)
      .eq('direction', 'right');
    if (e1) throw e1;

    if (!mySwipes?.length) {
      container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-20">
          <span class="text-5xl">💫</span>
          <p class="font-bold text-lg text-slate-700">Sin matches todavía</p>
          <p class="text-sm text-slate-400">Aún no tenéis matches. ¡Seguid explorando!</p>
        </div>`;
      return;
    }

    const myIds       = mySwipes.map(s => s.fantasy_id);
    const swipeDateOf = Object.fromEntries(mySwipes.map(s => [s.fantasy_id, s.created_at]));

    // Swipes right de la pareja — solo en las fantasías que yo ya aprobé
    const partnerId = couple.user1_id === user.id ? couple.user2_id : couple.user1_id;
    const { data: partnerSwipes } = await supabase
      .from('fantasy_swipes')
      .select('fantasy_id')
      .eq('user_id', partnerId)
      .eq('couple_id', couple.id)
      .eq('direction', 'right')
      .in('fantasy_id', myIds);

    const partnerSet = new Set((partnerSwipes || []).map(s => s.fantasy_id));
    const matchIds   = myIds.filter(id => partnerSet.has(id));

    if (!matchIds.length) {
      container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-20">
          <span class="text-5xl">💫</span>
          <p class="font-bold text-lg text-slate-700">Sin matches mutuos todavía</p>
          <p class="text-sm text-slate-400">Aún no tenéis matches. ¡Seguid explorando!</p>
        </div>`;
      return;
    }

    // Cargar datos de las fantasías con match mutuo
    const { data: fantasies, error: e3 } = await supabase
      .from('fantasies')
      .select('id, title, category, emoji')
      .in('id', matchIds);
    if (e3) throw e3;

    const fantasyMap = Object.fromEntries((fantasies || []).map(f => [f.id, f]));

    container.innerHTML = `
      <div class="px-5 py-3">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[.15em] mb-4">
          ${matchIds.length} match${matchIds.length !== 1 ? 'es' : ''} mutuos
        </p>
        <div class="flex flex-col gap-3">
          ${matchIds.map(id => {
            const f    = fantasyMap[id] || {};
            const date = swipeDateOf[id]
              ? new Date(swipeDateOf[id]).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
              : '';
            return `
              <div class="bg-white rounded-2xl px-4 py-3 flex items-center gap-3
                          border border-slate-100 shadow-sm">
                <span class="text-3xl">${f.emoji || _fantasyEmoji(f.category)}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-slate-800 truncate">
                    ${_esc(f.title || 'Fantasía')}
                  </p>
                  ${date ? `<p class="text-[11px] text-slate-400 mt-0.5">${date}</p>` : ''}
                </div>
                <span class="flex-shrink-0 bg-green-100 text-green-700 text-[10px]
                             font-bold px-2.5 py-1 rounded-full">
                  Match ✓
                </span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  } catch (_) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-20">
        <p class="text-slate-400 text-sm">Error al cargar el historial</p>
      </div>`;
  }
}

// ── Gesture: swipe touch + mouse ─────────────────────────────
function _wireSwipe(card, { onLike, onDiscard }) {
  if (!card) return;

  const THRESHOLD = 80;
  let startX = 0, startY = 0, curX = 0, curY = 0, dragging = false;

  function onStart(e) {
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    curX = curY = 0;
    dragging = true;
    card.style.transition = 'none';
    document.addEventListener('mousemove',  onMove);
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchmove',  onMove, { passive: false });
    document.addEventListener('touchend',   onEnd);
  }

  function onMove(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    curX = pt.clientX - startX;
    curY = pt.clientY - startY;

    // Ignorar gestos principalmente verticales
    if (Math.abs(curY) > Math.abs(curX) * 1.5 && Math.abs(curX) < 15) return;

    const rotate = curX * 0.07;
    card.style.transform = `translateX(${curX}px) translateY(${curY * 0.15}px) rotate(${rotate}deg)`;

    const pct      = Math.min(Math.abs(curX) / THRESHOLD, 1);
    const likeEl   = document.getElementById('ind-like');
    const nopeEl   = document.getElementById('ind-nope');
    if (curX > 10)  { if (likeEl) likeEl.style.opacity = pct; if (nopeEl) nopeEl.style.opacity = 0; }
    else if (curX < -10) { if (nopeEl) nopeEl.style.opacity = pct; if (likeEl) likeEl.style.opacity = 0; }
    else            { if (likeEl) likeEl.style.opacity = 0;   if (nopeEl) nopeEl.style.opacity = 0; }
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);

    if      (curX >  THRESHOLD) { onLike();    }
    else if (curX < -THRESHOLD) { onDiscard(); }
    else {
      card.style.transition = 'transform 0.4s cubic-bezier(.25,.46,.45,.94)';
      card.style.transform  = 'translateX(0) translateY(0) rotate(0deg)';
      const likeEl = document.getElementById('ind-like');
      const nopeEl = document.getElementById('ind-nope');
      if (likeEl) likeEl.style.opacity = 0;
      if (nopeEl) nopeEl.style.opacity = 0;
    }
  }

  card.addEventListener('mousedown',  onStart);
  card.addEventListener('touchstart', onStart, { passive: true });
}

// ── Animación de salida de la carta ───────────────────────────
function _animateCardOut(direction, callback) {
  const card = document.getElementById('swipe-card');
  if (!card) { callback(); return; }
  const x      = direction === 'right' ? window.innerWidth * 1.6 : -window.innerWidth * 1.6;
  const rotate = direction === 'right' ? 30 : -30;
  card.style.transition = 'transform 0.36s cubic-bezier(.25,.46,.45,.94), opacity 0.36s';
  card.style.transform  = `translateX(${x}px) rotate(${rotate}deg)`;
  card.style.opacity    = '0';
  setTimeout(callback, 360);
}

// ── Valida que un id sea UUID real (no temporal) ─────────────
function _isRealId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ── Registra el swipe en Supabase y avanza al siguiente ───────
async function _recordSwipe(direction, fantasy, couple, state, renderStack) {
  state.index++;
  _markSeenId(fantasy.id);

  // IDs temporales (fallbacks 'fb-X', IA 'ai-X', etc.): sin INSERT en BD
  if (!_isRealId(fantasy.id)) {
    if (direction === 'right') {
      _showMatchAnimation(fantasy, renderStack);
    } else {
      renderStack();
    }
    return;
  }

  try {
    await db.swipeFantasy(couple.id, fantasy.id, direction);
    if (direction === 'right') {
      const matches = await db.getMatches(couple.id);
      const isMatch = matches.some(m => String(m.id) === String(fantasy.id));
      if (isMatch) {
        _showMatchAnimation(fantasy, renderStack);
        return;
      }
    }
  } catch (_) { /* silencioso */ }
  renderStack();
}

// ── Overlay de match ─────────────────────────────────────────
function _showMatchAnimation(fantasy, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center';
  overlay.style.background = 'linear-gradient(135deg, #14213D 0%, #0D9488 100%)';
  overlay.innerHTML = `
    <div class="mb-4 text-7xl" style="animation:bounce 1s infinite">💞</div>
    <h2 class="text-4xl font-black text-white mb-2">¡Match!</h2>
    <p class="text-white/70 text-base mb-3">¡A los dos les interesa!</p>
    <p class="text-white font-bold text-xl mb-10 px-4">${_esc(fantasy.title || '')}</p>
    <button id="match-ok"
            class="px-10 py-4 bg-white font-bold rounded-full active:scale-95 transition-transform text-base"
            style="color:#14213D">
      ¡Genial! 🎉
    </button>`;
  document.getElementById('app').appendChild(overlay);
  document.getElementById('match-ok')?.addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}

// ── Bottom sheet: ficha completa de una fantasía ─────────────
function _showFantasySheet(fantasy) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-end';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="fsh-backdrop"></div>
    <div id="fsh-panel"
         class="relative w-full bg-white rounded-t-3xl pb-10 shadow-2xl
                translate-y-full transition-transform duration-300
                max-h-[80vh] overflow-y-auto">
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-slate-200 rounded-full"></div>
      </div>
      <div class="px-6 py-4 space-y-4">
        ${fantasy.category ? `
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary
                     text-[10px] font-bold uppercase tracking-wider">
          ${_esc(_categoryLabel(fantasy.category))}
        </span>` : ''}
        <h2 class="text-2xl font-bold text-slate-900">${_esc(fantasy.title || '')}</h2>
        <p class="text-slate-600 text-sm leading-relaxed">${_esc(fantasy.description || '')}</p>
        <div class="flex gap-3 flex-wrap">
          ${fantasy.duration_label ? `
          <span class="flex items-center gap-1.5 px-3 py-2 bg-slate-100 rounded-full
                       text-sm font-medium text-slate-600">
            <span class="material-symbols-outlined text-base text-slate-400">timer</span>
            ${_esc(fantasy.duration_label)}
          </span>` : ''}
          ${fantasy.intensity_label ? `
          <span class="flex items-center gap-1.5 px-3 py-2 bg-slate-100 rounded-full
                       text-sm font-medium text-slate-600">
            <span class="material-symbols-outlined text-base text-slate-400">bolt</span>
            ${_esc(fantasy.intensity_label)}
          </span>` : ''}
        </div>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  requestAnimationFrame(() =>
    document.getElementById('fsh-panel')?.classList.remove('translate-y-full')
  );
  document.getElementById('fsh-backdrop')?.addEventListener('click', () => {
    const p = document.getElementById('fsh-panel');
    if (p) { p.classList.add('translate-y-full'); setTimeout(() => modal.remove(), 300); }
    else modal.remove();
  });
}

// ── Emoji por categoría de fantasía ──────────────────────────
function _fantasyEmoji(category) {
  const MAP = {
    sensorial: '🔥', sensual: '🌹',
    romantico: '💕', romantica: '💕',
    aventura: '⚡', adventurous: '⚡',
    juego: '🎲', masaje: '✨',
    role_play: '🎭', roleplay: '🎭',
    exterior: '🌙', outdoor: '🌙',
    sorpresa: '🎁',
    desafio: '🫦', desafío: '🫦',
    conexion: '💞', conexión: '💞',
  };
  const k = (category || '').toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[áà]/g,'a').replace(/[éè]/g,'e')
    .replace(/[íì]/g,'i').replace(/[óò]/g,'o').replace(/[úù]/g,'u');
  return MAP[k] || '💫';
}

// ── Etiqueta legible por categoría ───────────────────────────
function _categoryLabel(category) {
  const MAP = {
    sensorial: 'Sensorial', sensual: 'Sensual',
    romantico: 'Romántico', romantica: 'Romántico',
    aventura: 'Aventura',
    juego: 'Juego',
    masaje: 'Masaje',
    role_play: 'Rol', roleplay: 'Rol',
    exterior: 'Aventura', outdoor: 'Aventura',
    sorpresa: 'Sorpresa',
    desafio: 'Desafío', desafío: 'Desafío',
    conexion: 'Conexión', conexión: 'Conexión',
  };
  const k = (category || '').toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[áà]/g,'a').replace(/[éè]/g,'e')
    .replace(/[íì]/g,'i').replace(/[óò]/g,'o').replace(/[úù]/g,'u');
  return MAP[k] || category || '';
}


// ════════════════════════════════════════════════════════════
// RULETA DE CITAS
// ════════════════════════════════════════════════════════════
async function initRuleta(router) {
  const app  = document.getElementById('app');
  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const couple = await db.getMyCouple().catch(() => null);

  const FILTER_GROUPS = [
    { label: 'TIEMPO', key: 'duration_label', options: [
      { label: 'Express (<1h)',    value: 'express'  },
      { label: 'Estándar (2-3h)', value: 'estandar' },
      { label: 'Larga duración',  value: 'larga'    },
    ]},
    { label: 'COSTO', key: 'cost_type', options: [
      { label: 'Gratis',    value: 'free'    },
      { label: 'Económico', value: 'budget'  },
      { label: 'Premium',   value: 'premium' },
    ]},
    { label: 'AMBIENTE', key: 'mood_type', options: [
      { label: 'Relajado',   value: 'relaxed'   },
      { label: 'Energético', value: 'energetic' },
      { label: 'Romántico',  value: 'romantic'  },
    ]},
  ];

  const activeFilters = {};
  let spinning = false;
  let lastPlanTitle = null;

  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#F5F0E8] font-display text-slate-900">

      <!-- Header -->
      <header class="sticky top-0 z-10 bg-[#F5F0E8]/90 backdrop-blur-md px-4 py-4
                     flex flex-col items-center justify-center border-b border-primary/5">
        <h1 class="font-bold tracking-tight text-2xl">Ruleta de citas</h1>
        <p class="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">
          Crea tu cita perfecta
        </p>
      </header>

      <main class="flex-1 overflow-y-auto pb-32">

        <!-- Paso 1: Filtros -->
        <section class="px-4 py-6">
          <div class="flex items-center gap-2 mb-5">
            <span class="bg-primary text-white w-6 h-6 rounded-full flex items-center
                         justify-center text-xs font-bold flex-shrink-0">1</span>
            <h2 class="font-bold text-lg">Selecciona el estilo</h2>
          </div>
          <div class="space-y-5">
            ${FILTER_GROUPS.map(g => `
              <div>
                <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  ${g.label}
                </h3>
                <div class="flex flex-wrap gap-2">
                  ${g.options.map(o => `
                    <button data-group="${g.key}" data-value="${o.value}"
                            class="filter-chip px-5 py-2.5 rounded-full text-sm font-medium
                                   border border-slate-200 bg-white text-slate-600
                                   active:scale-95 transition-all">
                      ${_esc(o.label)}
                    </button>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- Paso 2: Ruleta -->
        <section class="px-4 py-6" style="background:rgba(232,222,209,.4)">
          <style>
            @keyframes _btn-pulse {
              0%,100%{box-shadow:0 8px 24px rgba(13,150,139,.32)}
              50%{box-shadow:0 8px 36px rgba(13,150,139,.58),0 0 24px rgba(13,150,139,.18)}
            }
            #girar-btn:not(:disabled){animation:_btn-pulse 2.2s ease-in-out infinite}
            #girar-btn:disabled{animation:none}
          </style>
          <div class="flex items-center gap-2 mb-5">
            <span class="bg-primary text-white w-6 h-6 rounded-full flex items-center
                         justify-center text-xs font-bold flex-shrink-0">2</span>
            <h2 class="font-bold text-lg">Descubre tu cita</h2>
          </div>
          <div class="flex flex-col items-center gap-5">

            <!-- Puntero -->
            <div id="wheel-pointer"
                 style="width:0;height:0;
                        border-left:14px solid transparent;
                        border-right:14px solid transparent;
                        border-top:26px solid #0D968B;
                        filter:drop-shadow(0 4px 8px rgba(13,150,139,.45));
                        transition:transform 0.08s ease;
                        position:relative;z-index:10;margin-bottom:-6px"></div>

            <!-- Rueda -->
            <div id="wheel-wrap"
                 style="position:relative;width:288px;height:288px;
                        transition:filter 0.5s ease">
              <canvas id="wheel-canvas"
                      style="border-radius:50%;display:block;
                             box-shadow:0 12px 36px rgba(13,150,139,.2),
                                        0 0 0 5px rgba(13,150,139,.08)"></canvas>
            </div>

            <!-- Botón GIRAR -->
            <button id="girar-btn"
                    class="flex min-w-[210px] items-center justify-center rounded-xl h-14
                           px-8 bg-primary text-white text-lg font-bold
                           active:scale-95 transition-transform select-none"
                    style="box-shadow:0 8px 24px rgba(13,150,139,.32)">
              <span class="material-symbols-outlined mr-2 text-2xl">casino</span>
              GIRAR
            </button>
          </div>
        </section>

        <!-- Paso 3: Resultado (oculto hasta primera tirada) -->
        <section id="resultado-section" class="hidden px-4 py-6">
          <div class="flex items-center gap-2 mb-4">
            <span class="bg-primary text-white w-6 h-6 rounded-full flex items-center
                         justify-center text-xs font-bold flex-shrink-0">3</span>
            <h2 class="font-bold text-lg">¡Tu cita de hoy!</h2>
          </div>
          <div id="resultado-card"
               class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          </div>
        </section>

      </main>

      <!-- Nav fija -->
      <div class="fixed bottom-5 left-0 right-0 z-20 px-8">
        <div class="max-w-[310px] mx-auto h-14 bg-white rounded-full
                    flex items-center justify-between px-2"
             style="box-shadow:0 8px 30px rgba(0,0,0,.08)">
          <a data-nav="/home"
             class="flex flex-1 flex-col items-center justify-center cursor-pointer text-slate-400">
            <span class="material-symbols-outlined text-xl">home</span>
          </a>
          <a data-nav="/capsulas"
             class="flex flex-1 flex-col items-center justify-center cursor-pointer text-slate-400">
            <span class="material-symbols-outlined text-xl">checklist</span>
          </a>
          <div class="flex flex-1 justify-center">
            <button class="w-10 h-10 bg-primary rounded-full flex items-center justify-center
                           text-white shadow-md active:scale-95 transition-transform">
              <span class="material-symbols-outlined text-xl">add</span>
            </button>
          </div>
          <a data-nav="/intimo"
             class="flex flex-1 flex-col items-center justify-center cursor-pointer text-slate-400">
            <span class="material-symbols-outlined text-xl">auto_awesome</span>
          </a>
          <a data-nav="/ruleta"
             class="flex flex-1 flex-col items-center justify-center cursor-pointer text-primary">
            <span class="material-symbols-outlined text-xl"
                  style="font-variation-settings:'FILL' 1">person</span>
          </a>
        </div>
      </div>
    </div>`;

  window.tailwind?.refresh?.();

  // Nav
  document.querySelectorAll('#app [data-nav]').forEach(el =>
    el.addEventListener('click', () => router.navigate(el.dataset.nav))
  );

  // Init rueda
  _ruletaInitWheel();

  // Filter chips — toggle único por grupo
  document.querySelectorAll('#app .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const group   = btn.dataset.group;
      const value   = btn.dataset.value;
      const already = activeFilters[group] === value;

      // Desactivar todos en el grupo
      document.querySelectorAll(`#app .filter-chip[data-group="${group}"]`).forEach(b => {
        b.classList.remove('bg-primary', 'text-white', 'border-primary', 'font-bold', 'shadow-sm');
        b.classList.add('bg-white', 'text-slate-600', 'border-slate-200', 'font-medium');
      });

      if (already) {
        delete activeFilters[group];
      } else {
        activeFilters[group] = value;
        btn.classList.add('bg-primary', 'text-white', 'border-primary', 'font-bold', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200', 'font-medium');
      }
    });
  });

  // Botón GIRAR
  document.getElementById('girar-btn')?.addEventListener('click', async () => {
    if (spinning) return;
    spinning = true;

    const btn = document.getElementById('girar-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; }

    try {
      // Mapear filtros UI → contexto para la IA
      const aiFilters = {
        durationFilter: { express:'menos de 1 hora', estandar:'2 a 3 horas', larga:'medio día o más' }[activeFilters.duration_label] || undefined,
        costFilter:     { free:'gratuito', budget:'económico', premium:'especial/premium' }[activeFilters.cost_type]                  || undefined,
        moodFilter:     { relaxed:'tranquilo y relajado', energetic:'activo y divertido', romantic:'romántico e íntimo' }[activeFilters.mood_type] || undefined,
        previousPlan:   lastPlanTitle || undefined,
      };

      // Construir la promesa de la IA (arranca ya, sin await aquí)
      const aiPromise = (async () => {
        let winner = null;
        try {
          const partner = await db.getPartner().catch(() => null);
          const ctx     = await buildContext(user, couple, partner, aiFilters);
          winner        = await aiGenerate('date_plan', ctx);
        } catch (aiErr) {
          console.warn('[Ruleta] IA no disponible, usando Supabase:', aiErr.message);
        }
        if (!winner) {
          const allPlans = await db.getDatePlans();
          const { plans: filtered, relaxed } = _findBestMatch(allPlans, activeFilters);
          if (!filtered || filtered.length === 0)
            throw new Error('Sin planes para esa combinación. Prueba con menos filtros.');
          if (relaxed) showToast('No hay planes exactos, mostrando el más cercano', 'neutral', 2500);
          const sh = _shuffleArray(filtered);
          winner = sh[_cryptoRandInt(sh.length)];
        }
        return winner;
      })();

      // La ruleta empieza a girar de inmediato; frena cuando llega el resultado
      const winner = await _ruletaSpinWithResult(aiPromise);
      lastPlanTitle = winner.title || null;
      _ruletaShowResult(winner, couple);
    } catch (err) {
      console.error('[Ruleta] Error al girar:', err);
      showToast(err.message?.includes('Sin planes') ? err.message : 'Error al obtener planes',
                err.message?.includes('Sin planes') ? 'neutral' : 'error',
                4000);
    }

    spinning = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  });
}

// ── Selecciona el mejor conjunto de planes según filtros activos ──
// Devuelve { plans, relaxed } donde relaxed=true indica que se
// relajaron los filtros para encontrar resultados.
function _findBestMatch(allPlans, activeFilters) {
  const dur  = activeFilters.duration_label;
  const cost = activeFilters.cost_type;
  const mood = activeFilters.mood_type;

  // Mapea duration_label → cost_type equivalente para filtrado client-side
  const durCostMap = { express: 'free', estandar: 'budget', larga: 'premium' };
  const durCost = dur ? durCostMap[dur] : null;

  const by = (useDur, useCost, useMood) => {
    let r = allPlans;
    if (useDur  && durCost) r = r.filter(p => p.cost_type === durCost);
    if (useCost && cost)    r = r.filter(p => p.cost_type === cost);
    if (useMood && mood)    r = r.filter(p => p.mood_type === mood);
    return r;
  };

  // 1. Los 3 filtros activos
  let plans = by(true, true, true);
  if (plans.length > 0) return { plans, relaxed: false };

  // 2. Sin TIEMPO
  plans = by(false, true, true);
  if (plans.length > 0) return { plans, relaxed: true };

  // 3. Sin AMBIENTE
  plans = by(true, true, false);
  if (plans.length > 0) return { plans, relaxed: true };

  // 4. Sin COSTO
  plans = by(true, false, true);
  if (plans.length > 0) return { plans, relaxed: true };

  // 5. Solo COSTO
  plans = by(false, true, false);
  if (plans.length > 0) return { plans, relaxed: true };

  // 6. Sin filtros
  return { plans: allPlans, relaxed: !!(dur || cost || mood) };
}

// ── RULETA: estado y constantes ───────────────────────────────
let _wheelCtx = null;
let _wheelDpr = 1;
let _wheelRot = 0;          // grados acumulados (nunca se resetea, para continuidad)
let _wheelLastSeg = -1;     // para detectar cruce de segmento

const _WHEEL_N      = 8;
const _WHEEL_DEG    = 360 / _WHEEL_N;
const _WHEEL_SIZE   = 288;
const _WHEEL_LABELS = ['🍕 Cena','🎬 Peli','🎮 Juegos','🌿 Paseo','❤️ Íntimo','🏃 Activo','🎭 Arte','✨ Sorpresa'];
let _wheelSegments  = [..._WHEEL_LABELS]; // se baraja cada giro
const _WHEEL_COLORS = ['#0D968B','#0A7568','#0D968B','#0A7568','#0D968B','#0A7568','#0D968B','#0A7568'];

// ── Inicializa el canvas con DPR correcto y dibuja la rueda ───
function _ruletaInitWheel() {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  _wheelDpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width  = _WHEEL_SIZE * _wheelDpr;
  canvas.height = _WHEEL_SIZE * _wheelDpr;
  canvas.style.width  = _WHEEL_SIZE + 'px';
  canvas.style.height = _WHEEL_SIZE + 'px';
  _wheelCtx = canvas.getContext('2d');
  _wheelCtx.scale(_wheelDpr, _wheelDpr);
  _wheelRot = 0;
  _wheelSegments = [..._WHEEL_LABELS];
  _ruletaDrawWheel(0);
}

// ── Dibuja la rueda entera en el ángulo dado ──────────────────
function _ruletaDrawWheel(deg) {
  const ctx = _wheelCtx;
  if (!ctx) return;
  const S = _WHEEL_SIZE;
  const cx = S / 2, cy = S / 2;
  const r  = S / 2 - 6;

  ctx.clearRect(0, 0, S, S);

  // ── Segmentos ────────────────────────────────────────────────
  for (let i = 0; i < _WHEEL_N; i++) {
    const a0 = (i       * _WHEEL_DEG + deg - 90) * Math.PI / 180;
    const a1 = ((i + 1) * _WHEEL_DEG + deg - 90) * Math.PI / 180;
    const am = (i * _WHEEL_DEG + _WHEEL_DEG / 2 + deg - 90) * Math.PI / 180;

    // Relleno
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = _WHEEL_COLORS[i];
    ctx.fill();

    // Borde separador suave
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Etiqueta (emoji + texto) ─────────────────────────────
    const lx = cx + Math.cos(am) * (r * 0.62);
    const ly = cy + Math.sin(am) * (r * 0.62);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(am + Math.PI / 2);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const [emoji, ...words] = _wheelSegments[i].split(' ');
    // Emoji
    ctx.font      = '14px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(emoji, 0, -7);
    // Texto
    ctx.font      = 'bold 8.5px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(words.join(' ').toUpperCase(), 0, 5.5);
    ctx.restore();
  }

  // ── Puntos decorativos en las líneas de segmento ────────────
  for (let i = 0; i < _WHEEL_N; i++) {
    const a = (i * _WHEEL_DEG + deg - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  }

  // ── Borde exterior ──────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── Aro interior decorativo ─────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Capuchón central ────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.font          = '15px system-ui';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText('🎯', cx, cy + 1);
}

// ── Mapeo mood_type → label de segmento que debe quedar apuntado ─
const _MOOD_SEGMENT = {
  romantic:  ['❤️ Íntimo'],
  relaxed:   ['🌿 Paseo', '🎬 Peli', '🍕 Cena'],
  energetic: ['🏃 Activo', '🎭 Arte'],
};

// ── Calcula el ángulo que pone el segmento segIdx bajo el puntero ─
function _targetDegForSeg(segIdx) {
  return ((-(segIdx * _WHEEL_DEG + _WHEEL_DEG / 2)) % 360 + 360) % 360;
}

// ── Rebote del puntero al cruzar segmento ───────────────────────
function _pointerBounce() {
  const ptr = document.getElementById('wheel-pointer');
  if (!ptr) return;
  ptr.style.transform = 'scaleY(0.58) translateY(5px)';
  setTimeout(() => { if (ptr) ptr.style.transform = ''; }, 85);
}

// ── Flash de victoria ────────────────────────────────────────────
function _winFlash() {
  const wrap = document.getElementById('wheel-wrap');
  const ptr  = document.getElementById('wheel-pointer');
  if (wrap) {
    wrap.style.filter = 'drop-shadow(0 0 24px rgba(13,150,139,.75))';
    setTimeout(() => { if (wrap) wrap.style.filter = ''; }, 750);
  }
  if (ptr) {
    ptr.style.transform = 'scaleY(1.6) translateY(-6px)';
    setTimeout(() => { if (ptr) ptr.style.transform = ''; }, 230);
  }
}

/**
 * Giro de dos fases:
 *  1) Giro libre inmediato (velocidad constante) mientras la IA trabaja
 *  2) En cuanto llega el resultado, frena hasta el segmento correcto
 *
 * @param {Promise} aiPromise — promesa que resuelve con el plan ganador
 * @returns {Promise<object>} — el plan ganador
 */
function _ruletaSpinWithResult(aiPromise) {
  if (!_wheelCtx) return aiPromise; // sin canvas, devuelve directo

  // ── Barajar segmentos para esta tirada (variedad visual) ──────
  _wheelSegments = _shuffleArray([..._WHEEL_LABELS]);
  _ruletaDrawWheel(_wheelRot % 360);

  const FREE_SPEED   = 7;    // grados/frame ≈ 420 deg/s a 60 fps
  const MIN_FREE_MS  = 1400; // mínimo tiempo de giro libre antes de frenar
  const DECEL_MS     = 2400; // duración de la fase de frenado

  let deg      = _wheelRot;
  let phase    = 'free';     // 'free' | 'decel' | 'done'
  let rafId    = null;
  const t0Free = performance.now();

  return new Promise((resolve, reject) => {
    // ── Fase 1: giro libre ───────────────────────────────────────
    function freeSpin() {
      if (phase !== 'free') return;
      deg += FREE_SPEED;
      _ruletaDrawWheel(deg % 360);
      rafId = requestAnimationFrame(freeSpin);
    }
    rafId = requestAnimationFrame(freeSpin);

    // ── Cuando llega el resultado de la IA ───────────────────────
    aiPromise.then(winner => {
      const elapsed = performance.now() - t0Free;
      const waitMore = Math.max(0, MIN_FREE_MS - elapsed);

      setTimeout(() => {
        if (phase !== 'free') return;
        phase = 'decel';
        cancelAnimationFrame(rafId);

        // Encontrar segmento objetivo según mood_type
        const candidates = _MOOD_SEGMENT[winner.mood_type] || ['✨ Sorpresa'];
        let segIdx = -1;
        for (const label of candidates) {
          const idx = _wheelSegments.indexOf(label);
          if (idx !== -1) { segIdx = idx; break; }
        }
        if (segIdx === -1) segIdx = Math.floor(Math.random() * _WHEEL_N);

        // Ángulo destino dentro de [0, 360)
        const targetOffset = _targetDegForSeg(segIdx);
        const currentMod   = ((deg % 360) + 360) % 360;
        let   extra        = ((targetOffset - currentMod) % 360 + 360) % 360;
        // Al menos 1.5 vueltas de frenado para que se vea bien
        if (extra < 540) extra += 360 * Math.ceil((540 - extra) / 360);
        const targetDeg  = deg + extra;
        const startDeg   = deg;
        const t0Decel    = performance.now();
        _wheelLastSeg    = Math.floor((currentMod + 90) / _WHEEL_DEG) % _WHEEL_N;

        const ease = t => 1 - Math.pow(1 - t, 4); // cuártica suave

        // ── Fase 2: frenado hacia el segmento ───────────────────
        function decelSpin(now) {
          const t   = Math.min((now - t0Decel) / DECEL_MS, 1);
          const cur = startDeg + (targetDeg - startDeg) * ease(t);
          _ruletaDrawWheel(cur % 360);

          // Rebote de puntero al cruzar segmento
          const seg = Math.floor(((cur % 360 + 360) % 360 + 90) / _WHEEL_DEG) % _WHEEL_N;
          if (seg !== _wheelLastSeg) { _wheelLastSeg = seg; _pointerBounce(); }

          if (t < 1) {
            requestAnimationFrame(decelSpin);
          } else {
            _wheelRot = targetDeg % 360;
            phase = 'done';
            _winFlash();
            resolve(winner);
          }
        }
        requestAnimationFrame(decelSpin);

      }, waitMore);

    }).catch(err => {
      cancelAnimationFrame(rafId);
      phase = 'done';
      reject(err);
    });
  });
}

// ── Muestra la tarjeta de resultado con botón Aceptar ─────────
function _ruletaShowResult(plan, couple) {
  const section = document.getElementById('resultado-section');
  const card    = document.getElementById('resultado-card');
  if (!section || !card) return;

  section.classList.remove('hidden');

  const emoji = _dateEmoji(plan.mood_type);

  card.innerHTML = `
    <!-- Título y descripción -->
    <div class="flex items-start gap-3">
      <span class="text-4xl flex-shrink-0 mt-0.5">${emoji}</span>
      <div class="flex-1 min-w-0">
        <h3 class="font-bold text-xl text-slate-900 leading-snug">${_esc(plan.title || '')}</h3>
        ${plan.description
          ? `<p class="text-slate-500 text-sm mt-1.5 leading-relaxed">${_esc(plan.description)}</p>`
          : ''}
      </div>
    </div>

    <!-- Tags -->
    <div class="flex flex-wrap gap-2">
      ${plan.mood_type ? `
      <span class="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
        ${_esc(plan.mood_type)}
      </span>` : ''}
      ${plan.cost_type ? `
      <span class="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold">
        ${_esc(plan.cost_type)}
      </span>` : ''}
      ${plan.duration_label ? `
      <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
        ${_esc(plan.duration_label)}
      </span>` : ''}
      ${plan.location_type ? `
      <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
        ${_esc(plan.location_type)}
      </span>` : ''}
    </div>

    <!-- Acciones -->
    <div class="flex gap-3">
      <button id="accept-date-btn"
              class="flex-1 bg-primary text-white font-bold py-3.5 rounded-full
                     active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style="box-shadow:0 6px 18px rgba(13,150,139,.25)">
        <span class="material-symbols-outlined text-base"
              style="font-variation-settings:'FILL' 1">favorite</span>
        Aceptar esta cita
      </button>
      <button id="regirar-btn"
              class="w-14 flex items-center justify-center rounded-full bg-white
                     border border-slate-200 text-slate-400 active:scale-95 transition-all">
        <span class="material-symbols-outlined text-xl">refresh</span>
      </button>
    </div>`;

  // Scroll suave al resultado
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

  // Aceptar cita → guardar en BD (solo si el plan tiene id; si es IA temporal, solo confirmar)
  document.getElementById('accept-date-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('accept-date-btn');

    if (!plan.id) {
      // Plan generado por IA sin BD — confirmar visualmente sin INSERT
      showToast('¡Cita anotada! Que la disfruten 🎉', 'success', 2500);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.65';
        btn.innerHTML = `<span class="material-symbols-outlined text-base"
                               style="font-variation-settings:'FILL' 1">check_circle</span>
                         Cita anotada`;
      }
      return;
    }

    if (!couple) {
      showToast('Vincula tu pareja para guardar la cita', 'neutral', 3000);
      return;
    }
    setButtonLoading(btn, true);
    try {
      await db.acceptDatePlan(couple.id, plan.id);
      showToast('¡Cita guardada! Que la disfruten 🎉', 'success', 2500);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.65';
        btn.innerHTML = `<span class="material-symbols-outlined text-base"
                               style="font-variation-settings:'FILL' 1">check_circle</span>
                         Cita guardada`;
      }
    } catch (err) {
      setButtonLoading(btn, false);
      showToast(err.message || 'Error al guardar la cita', 'error');
    }
  });

  // Regirar → reutilizar el botón principal
  document.getElementById('regirar-btn')?.addEventListener('click', () => {
    document.getElementById('girar-btn')?.click();
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _cryptoRandInt(max) {
  // Devuelve un entero criptográficamente aleatorio en [0, max)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function _shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = _cryptoRandInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _dateEmoji(mood) {
  const MAP = {
    romantico: '🌹', romantica: '🌹',
    relajado:  '☕', energetico: '⚡',
    aventura:  '🎯', sorpresa: '🎁',
  };
  return MAP[(mood || '').toLowerCase()] || '✨';
}


// ════════════════════════════════════════════════════════════
// TAREAS CONJUNTAS
// ════════════════════════════════════════════════════════════
async function initTareas(router) {
  qs('header button')?.addEventListener('click', () => history.back());

  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');

  const couple  = await db.getMyCouple().catch(() => null);
  const partner = couple ? await db.getPartner().catch(() => null) : null;

  if (!couple) {
    const main = qs('main');
    if (main) main.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <span class="material-symbols-outlined text-5xl text-slate-300">group</span>
        <p class="text-navy-dark font-semibold">Sin pareja vinculada</p>
        <p class="text-slate-400 text-sm px-8">Vincula tu pareja para gestionar tareas juntos</p>
      </div>`;
    return;
  }

  // ── Función de recarga (usada también por Realtime) ───────────
  async function reload() {
    try {
      const tasks = await db.getTasks(couple.id);
      _updateTaskStats(tasks);
      _renderPendingTasks(tasks.filter(t => !t.completed_at), user, partner);
      _renderCompletedTasks(
        tasks.filter(t => !!t.completed_at)
             .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
             .slice(0, 5),
        user, partner
      );
      _wireTaskActions(user, reload);
    } catch (err) {
      showToast('Error al cargar tareas', 'error');
    }
  }

  await reload();

  // ── Botón "Nueva Tarea" ───────────────────────────────────────
  qs('div.flex.justify-center button.bg-primary')
    ?.addEventListener('click', () => _showNewTaskModal(user, couple, partner, reload));

  // ── Supabase Realtime ─────────────────────────────────────────
  const channel = supabase
    .channel(`tareas-${couple.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'couple_tasks',
      filter: `couple_id=eq.${couple.id}`,
    }, async (payload) => {
      // Avisar si la pareja completó una tarea
      if (payload.eventType === 'UPDATE'
          && payload.new?.completed_at
          && payload.new?.completed_by
          && payload.new.completed_by !== user.id) {
        showToast(`${partner?.name || 'Tu pareja'} completó una tarea ✓`, 'neutral', 2500);
      }
      // Avisar si la pareja creó una tarea nueva
      if (payload.eventType === 'INSERT' && payload.new?.assigned_to !== user.id) {
        showToast(`${partner?.name || 'Tu pareja'} añadió una tarea`, 'neutral', 2500);
      }
      await reload();
    })
    .subscribe();

  window._emotiaChannel = channel;
}

// ── Actualiza los contadores de estadísticas ─────────────────
function _updateTaskStats(tasks) {
  const today = new Date().toISOString().split('T')[0];
  const pendingCount  = tasks.filter(t => !t.completed_at).length;
  const doneToday     = tasks.filter(t => t.completed_at?.startsWith(today)).length;
  const newToday      = tasks.filter(t => t.created_at?.startsWith(today) && !t.completed_at).length;

  const cards = document.querySelectorAll('#app .flex.gap-3.mb-8 > div');
  const numEl = (card) => card?.querySelector('p:last-child');
  if (numEl(cards[0])) numEl(cards[0]).textContent = pendingCount;
  if (numEl(cards[1])) numEl(cards[1]).textContent = doneToday;
  if (numEl(cards[2])) numEl(cards[2]).textContent = newToday;
}

// ── Renderiza la lista de tareas pendientes ───────────────────
function _renderPendingTasks(tasks, user, partner) {
  const container = qs('.space-y-4');
  if (!container) return;

  if (!tasks.length) {
    container.innerHTML = `
      <div class="text-center py-10">
        <span class="material-symbols-outlined text-5xl text-primary/30 block mb-2">task_alt</span>
        <p class="text-navy-dark/50 font-medium">¡Sin tareas pendientes!</p>
      </div>`;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const p = PRIORITY[task.priority] || PRIORITY.medium;
    const assignedHtml = _assignedHtml(task, user, partner);
    return `
      <div class="task-card bg-white rounded-2xl p-5 shadow-sm border border-navy-dark/5
                  flex items-start gap-4 transition-all duration-300"
           data-task-id="${task.id}">
        <button class="complete-btn mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2
                       border-primary/30 flex items-center justify-center
                       active:scale-90 transition-transform hover:border-primary hover:bg-primary/5">
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start mb-2 gap-2">
            <h3 class="font-bold text-lg text-navy-dark leading-snug">${_esc(task.title)}</h3>
            <span class="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold
                         uppercase tracking-wider ${p.bg} ${p.text}">
              ${p.label}
            </span>
          </div>
          <div class="flex items-center justify-between">
            ${assignedHtml}
            <button class="delete-btn text-slate-300 hover:text-red-400 active:scale-90
                           transition-all p-1 ml-2 flex-shrink-0">
              <span class="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Renderiza la lista de tareas completadas ──────────────────
function _renderCompletedTasks(tasks, user, partner) {
  const section = qs('.mb-12');
  if (!section) return;

  // Reutilizar o crear el contenedor
  let listEl = section.querySelector('.completed-list');
  if (!listEl) {
    listEl = document.createElement('div');
    listEl.className = 'completed-list space-y-3';
    const h2 = section.querySelector('h2');
    h2 ? h2.after(listEl) : section.appendChild(listEl);
  }

  if (!tasks.length) {
    listEl.innerHTML = `
      <p class="text-navy-dark/40 text-sm italic text-center py-4">
        Aún no hay tareas completadas
      </p>`;
    return;
  }

  listEl.innerHTML = tasks.map(task => {
    const byName = task.completed_by === user.id ? 'Yo' : (partner?.name || 'Tu pareja');
    const timeStr = task.completed_at
      ? new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `
      <div class="bg-white/40 rounded-2xl p-4 border border-navy-dark/5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary bg-primary/10 p-1.5 rounded-full">
            check_circle
          </span>
          <div>
            <p class="text-navy-dark font-semibold line-through opacity-50">${_esc(task.title)}</p>
            <p class="text-xs text-navy-dark/40">
              Completada por ${_esc(byName)}${timeStr ? ` a las ${timeStr}` : ''}
            </p>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── HTML del asignado ─────────────────────────────────────────
function _assignedHtml(task, user, partner) {
  let label = 'Sin asignar';
  let avatarHtml = '';

  if (!task.assigned_to) {
    label = 'Ambos';
    avatarHtml = `<span class="material-symbols-outlined text-slate-400 text-base">group</span>`;
  } else if (task.assigned_to === user.id) {
    label = 'Yo';
    avatarHtml = `<span class="material-symbols-outlined text-slate-400 text-base">person</span>`;
  } else {
    const name = task.assigned_to_user?.name || partner?.name || 'Pareja';
    const av   = task.assigned_to_user?.avatar_url || partner?.avatar_url;
    label = name;
    avatarHtml = av
      ? `<img src="${_esc(av)}" class="w-5 h-5 rounded-full object-cover" alt="${_esc(name)}">`
      : `<span class="material-symbols-outlined text-slate-400 text-base">person</span>`;
  }

  return `
    <div class="flex items-center gap-2">
      ${avatarHtml}
      <p class="text-sm text-navy-dark/60">
        ${label === 'Ambos'
          ? '<span class="font-medium">Ambos</span>'
          : `Asignada a: <span class="font-medium">${_esc(label)}</span>`}
      </p>
    </div>`;
}

// ── Conecta las acciones de completar y eliminar ──────────────
function _wireTaskActions(user, reload) {
  // Completar — tap en el círculo
  document.querySelectorAll('#app .task-card .complete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card   = btn.closest('.task-card');
      const taskId = card?.dataset.taskId;
      if (!taskId) return;

      card.style.transition = 'all 0.3s ease';
      card.style.opacity    = '0.4';
      card.style.transform  = 'scale(0.97)';

      try {
        await db.completeTask(taskId);
        showToast('¡Tarea completada! ✓', 'success', 1500);
        await reload();
      } catch (err) {
        card.style.opacity   = '';
        card.style.transform = '';
        showToast(err.message || 'Error al completar', 'error');
      }
    });
  });

  // Eliminar — primer tap = aviso rojo, segundo tap = borrar
  document.querySelectorAll('#app .task-card .delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card   = btn.closest('.task-card');
      const taskId = card?.dataset.taskId;
      if (!taskId) return;

      if (!btn.dataset.confirming) {
        btn.dataset.confirming = '1';
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'warning';
        btn.classList.replace('text-slate-300', 'text-red-500');
        // Revertir si no hay segundo tap en 2 s
        setTimeout(() => {
          if (!btn.dataset.confirming) return;
          delete btn.dataset.confirming;
          const ic = btn.querySelector('.material-symbols-outlined');
          if (ic) ic.textContent = 'delete';
          btn.classList.replace('text-red-500', 'text-slate-300');
        }, 2000);
        return;
      }

      // Segundo tap confirmado
      delete btn.dataset.confirming;
      card.style.transition = 'all 0.3s ease';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(16px)';

      try {
        await db.deleteTask(taskId);
        setTimeout(() => reload(), 300);
      } catch (err) {
        card.style.opacity   = '';
        card.style.transform = '';
        showToast(err.message || 'Error al eliminar', 'error');
      }
    });
  });
}

// ── Modal bottom-sheet para nueva tarea ──────────────────────
function _showNewTaskModal(user, couple, partner, onCreated) {
  const modal = document.createElement('div');
  modal.id    = 'new-task-modal';
  modal.className = 'fixed inset-0 z-50 flex items-end';

  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="ntm-backdrop"></div>
    <div id="ntm-sheet"
         class="relative w-full bg-white rounded-t-3xl p-6 pb-10 space-y-5 shadow-2xl
                translate-y-full transition-transform duration-300">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold text-navy-dark">Nueva Tarea</h3>
        <button id="ntm-close" class="text-slate-400 active:scale-90 transition-transform">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <input id="ntm-title"
             class="w-full px-4 py-3 rounded-xl border border-slate-200
                    focus:border-primary focus:ring-1 focus:ring-primary
                    bg-white text-navy-dark placeholder:text-slate-400 outline-none transition-all"
             placeholder="Nombre de la tarea..." autocomplete="off" />

      <div class="space-y-2">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridad</p>
        <div class="flex gap-2" id="ntm-priority">
          <button data-p="high"   class="p-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-transparent bg-red-50   text-red-600   active:scale-95">Alta</button>
          <button data-p="medium" class="p-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-primary    bg-amber-50  text-amber-600 active:scale-95">Media</button>
          <button data-p="low"    class="p-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-transparent bg-blue-50   text-blue-600  active:scale-95">Baja</button>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Asignar a</p>
        <div class="flex gap-2" id="ntm-assign">
          <button data-a="me"      class="a-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-primary bg-primary/10 text-primary active:scale-95">Yo</button>
          <button data-a="partner" class="a-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-transparent bg-slate-100 text-slate-600 active:scale-95">
            ${_esc(partner?.name || 'Pareja')}
          </button>
          <button data-a="both"    class="a-btn flex-1 py-2 rounded-xl text-sm font-semibold border-2 border-transparent bg-slate-100 text-slate-600 active:scale-95">Ambos</button>
        </div>
      </div>

      <button id="ntm-create"
              class="w-full bg-primary text-white font-bold py-4 rounded-full
                     shadow-lg shadow-primary/20 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2">
        <span class="material-symbols-outlined text-xl">add</span>
        <span>Crear Tarea</span>
      </button>
    </div>`;

  document.getElementById('app').appendChild(modal);

  // Animar entrada
  requestAnimationFrame(() => {
    document.getElementById('ntm-sheet')?.classList.remove('translate-y-full');
  });

  let selPriority = 'medium';
  let selAssign   = 'me';

  const closeModal = () => {
    const sheet = document.getElementById('ntm-sheet');
    if (sheet) {
      sheet.classList.add('translate-y-full');
      setTimeout(() => modal.remove(), 300);
    } else { modal.remove(); }
  };

  document.getElementById('ntm-close')   ?.addEventListener('click', closeModal);
  document.getElementById('ntm-backdrop')?.addEventListener('click', closeModal);

  // Selector de prioridad
  modal.querySelectorAll('.p-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.p-btn').forEach(b => b.classList.replace('border-primary', 'border-transparent'));
      btn.classList.replace('border-transparent', 'border-primary');
      selPriority = btn.dataset.p;
    });
  });

  // Selector de asignación
  modal.querySelectorAll('.a-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.a-btn').forEach(b => {
        b.classList.remove('border-primary', 'bg-primary/10', 'text-primary');
        b.classList.add('border-transparent', 'bg-slate-100', 'text-slate-600');
      });
      btn.classList.add('border-primary', 'bg-primary/10', 'text-primary');
      btn.classList.remove('border-transparent', 'bg-slate-100', 'text-slate-600');
      selAssign = btn.dataset.a;
    });
  });

  // Crear tarea
  document.getElementById('ntm-create')?.addEventListener('click', async () => {
    const title = document.getElementById('ntm-title')?.value?.trim();
    if (!title) { showToast('Escribe el nombre de la tarea', 'error'); return; }

    const assignedTo = selAssign === 'me'      ? user.id
                     : selAssign === 'partner' ? (partner?.id || null)
                     : null;

    const createBtn = document.getElementById('ntm-create');
    setButtonLoading(createBtn, true);

    try {
      await db.createTask({ coupleId: couple.id, title, priority: selPriority, assignedTo });
      closeModal();
      showToast('Tarea creada ✓', 'success', 2000);
      await onCreated();
    } catch (err) {
      setButtonLoading(createBtn, false);
      showToast(err.message || 'Error al crear tarea', 'error');
    }
  });

  setTimeout(() => document.getElementById('ntm-title')?.focus(), 360);
}


// ════════════════════════════════════════════════════════════
// CÁPSULAS — GRABACIÓN
// ════════════════════════════════════════════════════════════
async function initCapsulaGrabar(router, params) {
  const app = document.getElementById('app');
  const preselectedCat = params?.category || 'sin_categoria';

  // Color de acento por categoría preseleccionada
  const CAT_ACCENT = {
    gratitud:'#F59E0B', recuerdos:'#8B5CF6', carta:'#F43F5E',
    humor:'#EAB308', animo:'#10B981', cancion:'#A855F7',
    confesion:'#0EA5E9', buenos_dias:'#F97316', sin_categoria:'#94A3B8',
  };
  const accentColor = CAT_ACCENT[preselectedCat] || '#14213D';

  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#F5F0E8] font-display text-slate-900">

      <!-- Header -->
      <header class="px-6 pt-10 pb-4 flex items-center gap-4">
        <button id="rec-back"
                class="w-10 h-10 bg-white rounded-full flex items-center justify-center
                       shadow-sm active:scale-95 transition-transform flex-shrink-0"
                style="box-shadow:0 2px 10px rgba(0,0,0,0.08)">
          <span class="material-symbols-outlined text-slate-700 text-xl">arrow_back</span>
        </button>
        <div>
          <h1 class="text-xl font-bold text-slate-900">Nueva cápsula</h1>
          <p class="text-xs text-slate-400 mt-0.5">
            ${(() => { const c = CAPSULE_CATS.find(x => x.key === preselectedCat); return c ? `${c.emoji} ${_esc(c.label)}` : 'Sin categoría'; })()}
          </p>
        </div>
      </header>

      <main class="flex-1 flex flex-col px-6 pb-10 gap-5">

        <!-- Área central de grabación -->
        <div class="flex-1 flex flex-col items-center justify-center gap-7">

          <!-- Timer -->
          <div class="text-center">
            <p id="rec-timer"
               class="text-6xl font-bold tracking-wider tabular-nums"
               style="color:#14213D">00:00</p>
            <p class="text-xs text-slate-400 mt-1.5 font-medium">máximo 02:00</p>
          </div>

          <!-- Onda de audio (solo en grabación) -->
          <div id="rec-wave" class="hidden flex items-end justify-center gap-1 h-12">
            ${[10,18,28,22,36,26,32,20,14,30,24,18,10].map((h,i) => `
              <div class="w-1.5 rounded-full animate-bounce"
                   style="height:${h}px;background:rgba(20,33,61,0.5);animation-delay:${i*0.07}s"></div>`).join('')}
          </div>

          <!-- Botón principal de grabación -->
          <div class="relative flex items-center justify-center">
            <!-- Anillo pulsante (solo durante grabación, oculto por defecto) -->
            <div id="rec-ring-outer" class="hidden absolute w-36 h-36 rounded-full opacity-20"
                 style="background:#14213D;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div>
            <div id="rec-ring-inner" class="hidden absolute w-32 h-32 rounded-full opacity-30"
                 style="background:#14213D;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite 0.3s"></div>
            <button id="rec-main-btn"
                    class="w-24 h-24 rounded-full flex items-center justify-center
                           active:scale-95 transition-all relative z-10"
                    style="background:#14213D;box-shadow:0 16px 40px rgba(20,33,61,.35)">
              <span id="rec-icon" class="material-symbols-outlined text-white text-5xl"
                    style="font-variation-settings:'FILL' 1">mic</span>
            </button>
          </div>

          <p id="rec-hint" class="text-sm text-slate-400 font-medium">Toca para grabar</p>
        </div>

        <!-- Previsualización (oculta hasta que se para la grabación) -->
        <div id="rec-preview" class="hidden flex flex-col gap-3">
          <div class="flex items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100"
               style="box-shadow:0 4px 16px rgba(0,0,0,0.06)">
            <button id="rec-play-btn"
                    class="w-12 h-12 rounded-full flex items-center justify-center
                           flex-shrink-0 active:scale-95 transition-transform"
                    style="background:#14213D1A">
              <span id="rec-play-icon" class="material-symbols-outlined text-2xl"
                    style="color:#14213D;font-variation-settings:'FILL' 1">play_arrow</span>
            </button>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-slate-800 text-sm">Vista previa</p>
              <p id="rec-preview-dur" class="text-xs text-slate-400 mt-0.5">00:00</p>
            </div>
            <button id="rec-discard"
                    class="w-9 h-9 rounded-full flex items-center justify-center
                           text-slate-300 active:text-red-400 active:scale-90 transition-all">
              <span class="material-symbols-outlined text-xl">delete</span>
            </button>
          </div>

          <button id="rec-send-btn"
                  class="w-full text-white font-bold py-4 rounded-full
                         active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  style="background:#14213D;box-shadow:0 8px 24px rgba(20,33,61,.25)">
            <span class="material-symbols-outlined text-xl"
                  style="font-variation-settings:'FILL' 1">send</span>
            <span>Enviar cápsula</span>
          </button>
        </div>

      </main>
    </div>

    <style>
      @keyframes ping {
        75%, 100% { transform: scale(1.4); opacity: 0; }
      }
    </style>`;

  window.tailwind?.refresh?.();

  // ── Estado interno ────────────────────────────────────────────
  let mediaRecorder   = null;
  let audioChunks     = [];
  let timerInterval   = null;
  let secondsElapsed  = 0;
  let audioBlob       = null;
  let previewAudio    = null;
  let selectedCat     = preselectedCat;
  const MAX_SECS      = 120;

  // ── Selectores ────────────────────────────────────────────────
  const timerEl   = document.getElementById('rec-timer');
  const waveEl    = document.getElementById('rec-wave');
  const mainBtn   = document.getElementById('rec-main-btn');
  const btnIcon   = document.getElementById('rec-icon');
  const hintEl    = document.getElementById('rec-hint');
  const previewEl = document.getElementById('rec-preview');
  const playBtn   = document.getElementById('rec-play-btn');
  const playIcon  = document.getElementById('rec-play-icon');
  const durEl     = document.getElementById('rec-preview-dur');
  const sendBtn   = document.getElementById('rec-send-btn');

  // Back
  document.getElementById('rec-back')?.addEventListener('click', () => {
    _stopAllRecording(mediaRecorder, timerInterval, previewAudio);
    history.back();
  });

  // ── Botón principal: grabar / parar ───────────────────────────
  mainBtn?.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // PARAR
      clearInterval(timerInterval);
      timerInterval = null;
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    } else {
      // GRABAR
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime   = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                       ? 'audio/webm;codecs=opus'
                       : MediaRecorder.isTypeSupported('audio/webm')
                       ? 'audio/webm' : '';
        mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        audioChunks   = [];
        secondsElapsed = 0;

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
          audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          // Ocultar anillos y onda
          document.getElementById('rec-ring-outer')?.classList.add('hidden');
          document.getElementById('rec-ring-inner')?.classList.add('hidden');
          if (waveEl)    waveEl.classList.add('hidden');
          // Mostrar preview
          if (previewEl) previewEl.classList.remove('hidden');
          if (hintEl)    hintEl.textContent = 'Grabación lista — revisa antes de enviar';
          // Botón a "re-grabar"
          mainBtn.style.background = '#E2E8F0';
          mainBtn.style.boxShadow  = '0 4px 12px rgba(0,0,0,.08)';
          if (btnIcon) { btnIcon.textContent = 'refresh'; btnIcon.style.color = '#64748B'; }
          if (durEl)   durEl.textContent = _fmtSecs(secondsElapsed);
          // Preparar preview audio
          previewAudio = new Audio(URL.createObjectURL(audioBlob));
          previewAudio.onended = () => {
            if (playIcon) { playIcon.textContent = 'play_arrow'; playIcon.style.fontVariationSettings = "'FILL' 1"; }
          };
        };

        mediaRecorder.start(100);

        // UI: estado grabando
        document.getElementById('rec-ring-outer')?.classList.remove('hidden');
        document.getElementById('rec-ring-inner')?.classList.remove('hidden');
        if (waveEl)   waveEl.classList.remove('hidden');
        if (hintEl)   hintEl.textContent = 'Grabando… toca para parar';
        if (btnIcon)  { btnIcon.textContent = 'stop'; btnIcon.style.fontVariationSettings = "'FILL' 1"; btnIcon.style.color = 'white'; }
        mainBtn.style.background = '#DC2626';
        mainBtn.style.boxShadow  = '0 16px 40px rgba(220,38,38,.4)';

        timerInterval = setInterval(() => {
          secondsElapsed++;
          if (timerEl) timerEl.textContent = _fmtSecs(secondsElapsed);
          if (secondsElapsed >= MAX_SECS) {
            // Parar automáticamente
            clearInterval(timerInterval);
            timerInterval = null;
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
          }
        }, 1000);

      } catch (err) {
        const msg = err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado'
          : 'No se pudo acceder al micrófono';
        showToast(msg, 'error');
      }
    }
  });

  // ── Previsualización: play/pause ──────────────────────────────
  playBtn?.addEventListener('click', () => {
    if (!previewAudio) return;
    if (previewAudio.paused) {
      previewAudio.play();
      if (playIcon) { playIcon.textContent = 'pause'; }
    } else {
      previewAudio.pause();
      if (playIcon) { playIcon.textContent = 'play_arrow'; }
    }
  });

  // ── Descartar grabación ───────────────────────────────────────
  document.getElementById('rec-discard')?.addEventListener('click', () => {
    previewAudio?.pause();
    audioBlob = null;
    audioChunks = [];
    secondsElapsed = 0;
    if (timerEl)   timerEl.textContent = '00:00';
    if (previewEl) previewEl.classList.add('hidden');
    if (hintEl)    hintEl.textContent = 'Toca para grabar';
    mainBtn.style.background = '#14213D';
    mainBtn.style.boxShadow  = '0 16px 40px rgba(20,33,61,.35)';
    if (btnIcon) { btnIcon.textContent = 'mic'; btnIcon.style.color = 'white'; }
  });

  // ── Enviar cápsula ────────────────────────────────────────────
  sendBtn?.addEventListener('click', async () => {
    if (!audioBlob) { showToast('Graba un audio primero', 'error'); return; }

    const couple  = await db.getMyCouple().catch(() => null);
    const partner = couple ? await db.getPartner().catch(() => null) : null;

    if (!couple || !partner) {
      showToast('Necesitas tener pareja vinculada para enviar cápsulas', 'neutral', 3000);
      return;
    }

    setButtonLoading(sendBtn, true);
    try {
      const { path } = await storage.uploadAudio(couple.id, audioBlob);
      await db.saveCapsule({
        receiverId:      partner.id,
        coupleId:        couple.id,
        category:        selectedCat,
        audioUrl:        path,          // guardamos el path, no la URL firmada que expira
        durationSeconds: secondsElapsed,
      });
      showToast('Cápsula enviada ✓', 'success', 2500);
      previewAudio?.pause();
      setTimeout(() => router.navigate('/capsulas'), 1500);
    } catch (err) {
      setButtonLoading(sendBtn, false);
      showToast(err.message || 'Error al enviar la cápsula', 'error');
    }
  });
}

// ── Para la grabación al salir de la pantalla ─────────────────
function _stopAllRecording(mediaRecorder, timerInterval, previewAudio) {
  if (timerInterval) clearInterval(timerInterval);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks().forEach(t => t.stop());
  }
  previewAudio?.pause();
}

// ── Formatea segundos como MM:SS ──────────────────────────────
function _fmtSecs(s) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}


// ════════════════════════════════════════════════════════════
// CÁPSULAS — REPRODUCCIÓN
// ════════════════════════════════════════════════════════════
async function initCapsulaReproducir(router, params) {
  const app     = document.getElementById('app');
  const capsule = params?.capsule;

  const session = await auth.getSession().catch(() => null);
  const user = session?.user ?? null;
  if (!user) return router.navigate('/onboarding/1');
  if (!capsule) return router.navigate('/capsulas');

  const cat        = CAPSULE_CATS.find(c => c.key === capsule.category) || CAPSULE_CATS[CAPSULE_CATS.length - 1];
  const senderName = capsule.sender?.name || 'Tu pareja';
  const senderAv   = capsule.sender?.avatar_url;
  const duration   = capsule.duration_seconds || 0;
  const dateStr    = capsule.created_at
    ? new Date(capsule.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  const WAVE_HEIGHTS = [8,14,20,28,36,24,32,20,16,28,22,36,28,16,24,32,20,14,8];

  // Color de fondo suave según categoría
  const CAT_GRADIENT = {
    gratitud:'linear-gradient(145deg,#FEF3C7,#FDE68A)',
    recuerdos:'linear-gradient(145deg,#EDE9FE,#DDD6FE)',
    carta:'linear-gradient(145deg,#FFE4E6,#FECDD3)',
    humor:'linear-gradient(145deg,#FEF9C3,#FEF08A)',
    animo:'linear-gradient(145deg,#D1FAE5,#A7F3D0)',
    cancion:'linear-gradient(145deg,#F3E8FF,#E9D5FF)',
    confesion:'linear-gradient(145deg,#E0F2FE,#BAE6FD)',
    buenos_dias:'linear-gradient(145deg,#FFEDD5,#FED7AA)',
    sin_categoria:'linear-gradient(145deg,#F1F5F9,#E2E8F0)',
  };
  const catGradient = CAT_GRADIENT[capsule.category] || CAT_GRADIENT.sin_categoria;

  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#F5F0E8] font-display text-slate-900">

      <!-- Header -->
      <header class="px-6 pt-10 pb-4 flex items-center gap-4">
        <button id="pl-back"
                class="w-10 h-10 bg-white rounded-full flex items-center justify-center
                       shadow-sm active:scale-95 transition-transform flex-shrink-0"
                style="box-shadow:0 2px 10px rgba(0,0,0,0.08)">
          <span class="material-symbols-outlined text-slate-700 text-xl">arrow_back</span>
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-bold leading-tight">${cat.emoji} ${_esc(cat.label)}</h1>
          <p class="text-xs text-slate-400 mt-0.5 truncate">${_esc(dateStr)}</p>
        </div>
      </header>

      <main class="flex-1 flex flex-col items-center justify-center px-6 pb-10 gap-6">

        <!-- Card del remitente con gradiente de categoría -->
        <div class="w-full rounded-3xl p-6 flex flex-col items-center gap-4"
             style="${catGradient};box-shadow:0 4px 20px rgba(0,0,0,0.08)">
          <div class="w-20 h-20 rounded-full overflow-hidden bg-white/70
                      flex items-center justify-center ring-4 ring-white/80"
               style="box-shadow:0 4px 16px rgba(0,0,0,0.1)">
            ${senderAv
              ? `<img src="${_esc(senderAv)}" class="w-full h-full object-cover" alt="${_esc(senderName)}">`
              : `<span class="material-symbols-outlined text-4xl text-slate-400"
                       style="font-variation-settings:'FILL' 1">person</span>`}
          </div>
          <div class="text-center">
            <p class="font-bold text-lg text-slate-900">${_esc(senderName)}</p>
            <p class="text-slate-600 text-sm mt-0.5">te envió una cápsula de voz</p>
          </div>
        </div>

        <!-- Player card -->
        <div class="w-full bg-white rounded-3xl p-6 flex flex-col gap-5"
             style="box-shadow:0 4px 24px rgba(0,0,0,0.07)">

          <!-- Waveform -->
          <div class="flex items-center justify-center gap-1 h-14">
            ${WAVE_HEIGHTS.map((h,i) => `
              <div id="wb-${i}"
                   class="rounded-full transition-all duration-100"
                   style="width:5px;height:${h}px;background:rgba(20,33,61,0.18)"></div>`).join('')}
          </div>

          <!-- Barra de progreso -->
          <div class="space-y-2">
            <div id="pl-track"
                 class="relative h-2 rounded-full cursor-pointer overflow-hidden"
                 style="background:#E2E8F0">
              <div id="pl-fill" class="h-full rounded-full transition-none"
                   style="width:0%;background:#14213D"></div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-400 tabular-nums font-medium">
              <span id="pl-current">00:00</span>
              <span>${_fmtSecs(duration)}</span>
            </div>
          </div>

          <!-- Botón play -->
          <div class="flex items-center justify-center">
            <button id="pl-play-btn"
                    class="w-20 h-20 rounded-full flex items-center justify-center
                           active:scale-95 transition-all"
                    style="background:#14213D;box-shadow:0 12px 32px rgba(20,33,61,.30)">
              <span id="pl-play-icon" class="material-symbols-outlined text-white text-5xl"
                    style="font-variation-settings:'FILL' 1">play_arrow</span>
            </button>
          </div>

          <p id="pl-status" class="text-center text-xs text-slate-400 font-medium">Cargando audio...</p>
        </div>

        <!-- Botón responder -->
        <button id="pl-reply-btn"
                class="w-full font-bold py-4 rounded-full
                       active:scale-[0.98] transition-all flex items-center justify-center gap-2
                       border-2 bg-transparent"
                style="border-color:#14213D;color:#14213D">
          <span class="material-symbols-outlined text-xl"
                style="font-variation-settings:'FILL' 1">mic</span>
          <span>Responder con cápsula</span>
        </button>

      </main>
    </div>`;

  window.tailwind?.refresh?.();

  // ── Referencias ──────────────────────────────────────────────
  const playBtn   = document.getElementById('pl-play-btn');
  const playIcon  = document.getElementById('pl-play-icon');
  const fillEl    = document.getElementById('pl-fill');
  const currentEl = document.getElementById('pl-current');
  const trackEl   = document.getElementById('pl-track');
  const statusEl  = document.getElementById('pl-status');

  // ── Marcar como leída (silencioso) ──────────────────────────
  if (!capsule.is_read) db.markCapsuleAsRead(capsule.id).catch(() => {});

  // ── Obtener URL firmada ──────────────────────────────────────
  let audio = null;
  let waveRaf = null;

  try {
    const signedUrl = await storage.refreshAudioUrl(capsule.audio_path);
    audio = new Audio(signedUrl);
    audio.preload = 'metadata';
    if (statusEl) statusEl.textContent = 'Listo para reproducir';
  } catch (_) {
    if (statusEl) statusEl.textContent = 'Error al cargar el audio';
    showToast('No se pudo cargar el audio', 'error');
    return;
  }

  // ── Animación de onda ────────────────────────────────────────
  function animateWave() {
    WAVE_HEIGHTS.forEach((_, i) => {
      const bar = document.getElementById(`wb-${i}`);
      if (!bar) return;
      bar.style.height          = `${6 + Math.random() * 42}px`;
      bar.style.background      = 'rgba(20,33,61,.6)';
      bar.style.transitionDuration = '80ms';
    });
    waveRaf = setTimeout(animateWave, 100);
  }

  function stopWave() {
    clearTimeout(waveRaf);
    waveRaf = null;
    WAVE_HEIGHTS.forEach((h, i) => {
      const bar = document.getElementById(`wb-${i}`);
      if (bar) {
        bar.style.height          = `${h}px`;
        bar.style.background      = 'rgba(20,33,61,.18)';
        bar.style.transitionDuration = '300ms';
      }
    });
  }

  // ── Progreso ─────────────────────────────────────────────────
  function tickProgress() {
    if (!audio || audio.paused) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    if (fillEl)    fillEl.style.width = `${pct}%`;
    if (currentEl) currentEl.textContent = _fmtSecs(Math.floor(audio.currentTime));
    requestAnimationFrame(tickProgress);
  }

  // ── Eventos de audio ─────────────────────────────────────────
  audio.addEventListener('ended', () => {
    stopWave();
    if (playIcon) playIcon.textContent = 'replay';
    if (statusEl) statusEl.textContent = 'Reproducción completada';
    if (fillEl)   fillEl.style.width = '100%';
    if (currentEl && audio.duration) currentEl.textContent = _fmtSecs(Math.floor(audio.duration));
  });

  audio.addEventListener('error', () => {
    if (statusEl) statusEl.textContent = 'Error al reproducir';
    showToast('Error al reproducir el audio', 'error');
  });

  // ── Play / Pause ─────────────────────────────────────────────
  playBtn?.addEventListener('click', async () => {
    if (!audio) return;
    if (audio.ended) {
      audio.currentTime = 0;
      if (fillEl) fillEl.style.width = '0%';
    }
    if (audio.paused) {
      try {
        await audio.play();
        if (playIcon) playIcon.textContent = 'pause';
        if (statusEl) statusEl.textContent = 'Reproduciendo...';
        animateWave();
        requestAnimationFrame(tickProgress);
      } catch (_) {
        showToast('No se pudo reproducir el audio', 'error');
      }
    } else {
      audio.pause();
      stopWave();
      if (playIcon) playIcon.textContent = 'play_arrow';
      if (statusEl) statusEl.textContent = 'Pausado';
    }
  });

  // ── Seek en barra de progreso ────────────────────────────────
  trackEl?.addEventListener('click', (e) => {
    if (!audio || !audio.duration) return;
    const rect = trackEl.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    if (fillEl)    fillEl.style.width = `${pct * 100}%`;
    if (currentEl) currentEl.textContent = _fmtSecs(Math.floor(audio.currentTime));
  });

  // ── Botón atrás ──────────────────────────────────────────────
  document.getElementById('pl-back')?.addEventListener('click', () => {
    audio?.pause();
    stopWave();
    history.back();
  });

  // ── Botón responder ──────────────────────────────────────────
  document.getElementById('pl-reply-btn')?.addEventListener('click', () => {
    audio?.pause();
    stopWave();
    router.navigate('/capsulas/grabar', { category: capsule.category || 'sin_categoria' });
  });
}


// ════════════════════════════════════════════════════════════
// SETTINGS (bottom sheet modal)
// ════════════════════════════════════════════════════════════
export async function showSettings(router) {
  const user    = await auth.getUser().catch(() => null);
  if (!user) return;
  const profile = await db.getMyProfile().catch(() => null);
  const couple  = await db.getMyCouple().catch(() => null);
  const partner = couple ? await db.getPartner().catch(() => null) : null;

  // Días juntos desde aniversario
  let togetherText = '';
  if (couple?.anniversary_date) {
    const totalDays = Math.floor((Date.now() - new Date(couple.anniversary_date)) / 86400000);
    const months    = Math.floor(totalDays / 30.44);
    const remDays   = Math.round(totalDays - months * 30.44);
    togetherText = months > 0
      ? `Juntos desde hace ${months} mes${months !== 1 ? 'es' : ''} y ${remDays} día${remDays !== 1 ? 's' : ''}`
      : `Juntos desde hace ${totalDays} día${totalDays !== 1 ? 's' : ''}`;
  }

  const code    = profile?.partner_code || '------';
  const name    = profile?.name || '';
  const avatar  = profile?.avatar_url;

  const avatarHtml = avatar
    ? `<img src="${avatar}" class="w-20 h-20 rounded-full object-cover border-4 border-primary/30" />`
    : `<div class="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/30 flex items-center justify-center">
         <span class="material-symbols-outlined text-primary" style="font-size:2.5rem">person</span>
       </div>`;

  const toggleHtml = (checked = true) => `
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''} />
      <div class="w-11 h-6 bg-slate-200 rounded-full peer
                  peer-checked:after:translate-x-full peer-checked:after:border-white
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                  after:bg-white after:border-gray-300 after:border after:rounded-full
                  after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>`;

  const partnerSection = (couple && partner)
    ? `<div class="flex items-center justify-between py-3">
         <div class="flex items-center gap-3">
           ${partner.avatar_url
             ? `<img src="${partner.avatar_url}" class="w-9 h-9 rounded-full object-cover" />`
             : `<div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                  <span class="material-symbols-outlined text-slate-400 text-xl">person</span>
                </div>`}
           <div>
             <p class="text-sm font-semibold text-slate-800">${_esc(partner.name || 'Pareja')}</p>
             <p class="text-xs text-slate-400">Vinculado/a</p>
           </div>
         </div>
         <button id="st-unlink"
                 class="text-red-500 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 active:scale-95 transition-transform">
           Desvincular
         </button>
       </div>`
    : `<div class="py-3">
         <p class="text-xs text-slate-400 mb-2">Introduce el código de tu pareja</p>
         <div class="flex gap-2">
           <input id="st-partner-input" type="text" maxlength="6" placeholder="ABC123"
                  class="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm uppercase
                         tracking-widest font-mono text-center outline-none focus:border-primary" />
           <button id="st-link-btn"
                   class="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl active:scale-95 transition-transform">
             Vincular
           </button>
         </div>
       </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;background:rgba(0,0,0,0);transition:background 0.3s';

  overlay.innerHTML = `
    <div id="st-backdrop" style="position:absolute;inset:0"></div>

    <div id="st-sheet"
         class="relative w-full bg-[#F5F0E8] rounded-t-3xl overflow-hidden font-display"
         style="max-height:92vh;transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.32,0.72,0,1)">

      <!-- Sticky header -->
      <div class="sticky top-0 z-10 bg-[#F5F0E8]/95 backdrop-blur-sm px-5 pt-4 pb-3">
        <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4"></div>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-xl tracking-tight text-slate-900">Ajustes</h2>
          <button id="st-close"
                  class="w-9 h-9 rounded-full bg-slate-200/80 flex items-center justify-center active:scale-95 transition-transform">
            <span class="material-symbols-outlined text-slate-500 text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Scrollable body -->
      <div class="overflow-y-auto px-5 pb-14" style="max-height:calc(92vh - 96px)">

        <!-- Hero perfil -->
        <div class="flex flex-col items-center gap-3 py-6">
          <div class="relative">
            <div id="st-avatar-wrap">${avatarHtml}</div>
            <button id="st-change-photo"
                    class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center
                           justify-center shadow-md active:scale-95 transition-transform">
              <span class="material-symbols-outlined text-white" style="font-size:1rem">photo_camera</span>
            </button>
            <input id="st-photo-input" type="file" accept="image/*" style="display:none" />
          </div>
          <div class="text-center">
            <p id="st-hero-name" class="font-bold text-xl text-slate-900">${_esc(name)}</p>
            ${togetherText ? `<p class="text-xs text-slate-400 mt-0.5">${_esc(togetherText)}</p>` : ''}
          </div>
        </div>

        <!-- Mi Perfil -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Mi Perfil</p>
        <div class="bg-white rounded-2xl shadow-sm mb-5">
          <div class="px-4 py-3.5">
            <div id="st-name-view" class="flex items-center justify-between">
              <div>
                <p class="text-[11px] text-slate-400 mb-0.5">Nombre</p>
                <p id="st-name-display" class="text-sm font-semibold text-slate-800">${_esc(name)}</p>
              </div>
              <button id="st-edit-name" class="text-primary text-sm font-semibold active:opacity-60">Editar</button>
            </div>
            <div id="st-name-edit" style="display:none;gap:0.5rem;margin-top:0.25rem" class="flex">
              <input id="st-name-input" type="text" value="${_esc(name)}"
                     class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" />
              <button id="st-name-save"
                      class="px-3 py-2 bg-primary text-white text-sm font-semibold rounded-xl active:scale-95 transition-transform">
                OK
              </button>
            </div>
          </div>
        </div>

        <!-- Mi Pareja -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Mi Pareja</p>
        <div class="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm mb-5">
          <div class="flex items-center justify-between px-4 py-3.5">
            <div>
              <p class="text-[11px] text-slate-400 mb-0.5">Tu código</p>
              <p class="text-lg font-black tracking-widest text-primary font-mono">${_esc(code)}</p>
            </div>
            <button id="st-copy-code"
                    class="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs
                           font-semibold rounded-full active:scale-95 transition-transform">
              <span class="material-symbols-outlined text-sm">content_copy</span>
              Copiar
            </button>
          </div>
          <div class="px-4">${partnerSection}</div>
        </div>

        <!-- Modo Íntimo -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Modo Íntimo</p>
        <div class="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm mb-5">
          <button class="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
                  onclick="showToast?.('El cambio de PIN estará disponible próximamente','neutral',2000)">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-slate-400">lock</span>
              <p class="text-sm font-medium text-slate-700">Cambiar PIN</p>
            </div>
            <span class="material-symbols-outlined text-slate-300">chevron_right</span>
          </button>
          <div class="flex items-center justify-between px-4 py-3.5">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-slate-400">face</span>
              <p class="text-sm font-medium text-slate-700">Usar Face ID / Touch ID</p>
            </div>
            ${toggleHtml(false)}
          </div>
        </div>

        <!-- Notificaciones -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Notificaciones</p>
        <div class="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm mb-5">
          ${[
            ['notifications', 'Pregunta del día'],
            ['mood',          'Check-in emocional'],
            ['mic',           'Cápsulas de audio'],
          ].map(([icon, label]) => `
            <div class="flex items-center justify-between px-4 py-3.5">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-slate-400">${icon}</span>
                <p class="text-sm font-medium text-slate-700">${label}</p>
              </div>
              ${toggleHtml(true)}
            </div>`).join('')}
        </div>

        <!-- Preferencias -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Preferencias</p>
        <div class="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm mb-5">
          <div class="flex items-center justify-between px-4 py-3.5">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-slate-400">language</span>
              <p class="text-sm font-medium text-slate-700">Idioma</p>
            </div>
            <div class="flex items-center gap-1 text-slate-400">
              <p class="text-sm">Español</p>
              <span class="material-symbols-outlined text-lg">chevron_right</span>
            </div>
          </div>
          <div class="px-4 py-3.5">
            <div class="flex items-center gap-3 mb-3">
              <span class="material-symbols-outlined text-slate-400">contrast</span>
              <p class="text-sm font-medium text-slate-700">Tema</p>
            </div>
            <div class="flex rounded-xl bg-slate-100 p-1 gap-1">
              ${[['light_mode','Claro',true], ['dark_mode','Oscuro',false], ['brightness_auto','Sistema',false]].map(([icon, lbl, active]) => `
                <button class="theme-btn flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                               ${active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}">
                  <span class="material-symbols-outlined" style="font-size:1rem">${icon}</span>${lbl}
                </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Cuenta -->
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Cuenta</p>
        <div class="bg-white rounded-2xl divide-y divide-slate-100 shadow-sm mb-5">
          <button id="st-sign-out"
                  class="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition-colors text-left">
            <span class="material-symbols-outlined text-primary">logout</span>
            <p class="text-sm font-medium text-primary">Cerrar sesión</p>
          </button>
          <button id="st-delete-account"
                  class="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-50 transition-colors text-left">
            <span class="material-symbols-outlined text-red-500">delete_forever</span>
            <p class="text-sm font-medium text-red-500">Eliminar cuenta</p>
          </button>
        </div>

      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Animar apertura
  requestAnimationFrame(() => {
    overlay.style.background = 'rgba(0,0,0,0.45)';
    document.getElementById('st-sheet').style.transform = 'translateY(0)';
  });

  function closeSheet() {
    overlay.style.background = 'rgba(0,0,0,0)';
    document.getElementById('st-sheet').style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 380);
  }

  document.getElementById('st-close').addEventListener('click', closeSheet);
  document.getElementById('st-backdrop').addEventListener('click', closeSheet);

  // Copiar código
  document.getElementById('st-copy-code')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Código copiado ✓', 'success', 1500);
    } catch (_) {
      showToast(`Tu código: ${code}`, 'neutral', 3000);
    }
  });

  // Editar nombre — mostrar input
  document.getElementById('st-edit-name')?.addEventListener('click', () => {
    document.getElementById('st-name-view').style.display  = 'none';
    document.getElementById('st-name-edit').style.display  = 'flex';
    document.getElementById('st-name-input')?.focus();
  });

  // Guardar nombre
  document.getElementById('st-name-save')?.addEventListener('click', async () => {
    const input   = document.getElementById('st-name-input');
    const newName = input?.value.trim();
    if (!newName || newName.length < 2) return showToast('El nombre es demasiado corto', 'error');
    try {
      await db.updateMyProfile({ name: newName });
      document.getElementById('st-name-display').textContent = newName;
      document.getElementById('st-hero-name').textContent    = newName;
      document.getElementById('st-name-view').style.display  = '';
      document.getElementById('st-name-edit').style.display  = 'none';
      showToast('Nombre actualizado ✓', 'success', 1500);
    } catch (_) {
      showToast('Error al actualizar nombre', 'error');
    }
  });

  // Cambiar foto
  document.getElementById('st-change-photo')?.addEventListener('click', () => {
    document.getElementById('st-photo-input')?.click();
  });

  document.getElementById('st-photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await storage.uploadAvatar(file);
      await db.updateMyProfile({ avatar_url: url });
      const wrap = document.getElementById('st-avatar-wrap');
      if (wrap) wrap.innerHTML = `<img src="${url}" class="w-20 h-20 rounded-full object-cover border-4 border-primary/30" />`;
      showToast('Foto actualizada ✓', 'success', 1500);
    } catch (_) {
      showToast('Error al subir foto', 'error');
    }
  });

  // Vincular pareja
  document.getElementById('st-link-btn')?.addEventListener('click', async () => {
    const input       = document.getElementById('st-partner-input');
    const partnerCode = input?.value.trim().toUpperCase();
    if (!partnerCode || partnerCode.length !== 6)
      return showToast('Introduce un código de 6 caracteres', 'error');
    try {
      await db.linkWithPartner(partnerCode);
      showToast('¡Pareja vinculada! 🎉', 'success', 2500);
      closeSheet();
    } catch (_) {
      showToast('Código no encontrado', 'error');
    }
  });

  // Desvincular pareja (solo informativo)
  document.getElementById('st-unlink')?.addEventListener('click', () => {
    showToast('Contacta con soporte para desvincular', 'neutral', 3000);
  });

  // Selector de tema
  overlay.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
      btn.classList.remove('text-slate-400');
    });
  });

  // Cerrar sesión
  document.getElementById('st-sign-out')?.addEventListener('click', async () => {
    try {
      await auth.signOut();
      closeSheet();
      setTimeout(() => router.navigate('/onboarding/1'), 400);
    } catch (_) {
      showToast('Error al cerrar sesión', 'error');
    }
  });

  // Eliminar cuenta — confirmación 2 pasos
  let deleteStep = 0;
  let deleteTimer = null;
  document.getElementById('st-delete-account')?.addEventListener('click', () => {
    deleteStep++;
    clearTimeout(deleteTimer);
    if (deleteStep === 1) {
      showToast('¿Seguro? Toca de nuevo para confirmar', 'error', 3500);
      deleteTimer = setTimeout(() => { deleteStep = 0; }, 4000);
    } else {
      showToast('Para eliminar tu cuenta contacta a soporte@emotia.app', 'neutral', 5000);
      deleteStep = 0;
    }
  });
}


// ════════════════════════════════════════════════════════════
// EXPORTACIÓN
// ════════════════════════════════════════════════════════════
export const ROUTE_MAP = {
  '/reflexion':            { html: reflexionRaw, init: initReflexion          },
  '/capsulas':             { html: capsulasRaw,  init: initCapsulas           },
  '/capsulas/grabar':      { html: capsulasRaw,  init: initCapsulaGrabar      },
  '/capsulas/reproducir':  { html: capsulasRaw,  init: initCapsulaReproducir  },
  '/intimo':               { html: intimoRaw,    init: initIntimo             },
  '/ruleta':               { html: ruletaRaw,    init: initRuleta             },
  '/tareas':               { html: tareasRaw,    init: initTareas             },
};
