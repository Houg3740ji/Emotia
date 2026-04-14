/**
 * EMOTIA — Pantalla Check-in Emocional con lógica real de Supabase
 */

import { auth, db } from '../../supabase.js';
import { showToast, setButtonLoading } from '../auth.js';

import checkinRaw from '../../../stitch_emotia/check_in_emojis_con_contenedores_ampliados/code.html?raw';

const qs = (sel) => document.querySelector(`#app ${sel}`);

// ── Definición de las 15 emociones (mismo orden que el HTML Stitch) ──
const EMOTIONS = [
  { emoji: '😊', name: 'Feliz',        negative: false },
  { emoji: '😍', name: 'Enamorado/a',  negative: false },
  { emoji: '🤩', name: 'Emocionado/a', negative: false },
  { emoji: '😌', name: 'En paz',       negative: false },
  { emoji: '🥰', name: 'Cariñoso/a',   negative: false },
  { emoji: '🤔', name: 'Pensativo/a',  negative: false },
  { emoji: '😢', name: 'Triste',       negative: true  },
  { emoji: '😰', name: 'Ansioso/a',    negative: true  },
  { emoji: '😤', name: 'Enfadado/a',   negative: true  },
  { emoji: '😴', name: 'Agotado/a',    negative: true  },
  { emoji: '😟', name: 'Preocupado/a', negative: true  },
  { emoji: '🤗', name: 'Agradecido/a', negative: false },
  { emoji: '😏', name: 'Travieso/a',   negative: false },
  { emoji: '😩', name: 'Abrumado/a',   negative: true  },
  { emoji: '💪', name: 'Motivado/a',   negative: false },
];

// ── Mensajes de apoyo para todas las emociones ───────────────
const SUPPORT_MESSAGES = {
  'Feliz':        'Tu alegría también nutre a tu pareja. Compártela con ella hoy.',
  'Enamorado/a':  'Exprésalo. Las palabras y los gestos también enamoran.',
  'Emocionado/a': '¡Contagia esa energía! Cuéntale a tu pareja qué te tiene así.',
  'En paz':       'La calma interior te hace más presente para quienes quieres.',
  'Cariñoso/a':   'Un abrazo o un detalle hoy puede hacer el día de tu pareja.',
  'Pensativo/a':  'Compartir lo que ronda tu cabeza puede aclararlo todo.',
  'Triste':       'Es válido sentirse así. ¿Quieres que tu pareja lo sepa?',
  'Ansioso/a':    'La ansiedad pasa. Respira y comparte cómo te sientes.',
  'Enfadado/a':   'Está bien sentir enfado. Compártelo con calma cuando puedas.',
  'Agotado/a':    'Necesitas descanso. Tu pareja puede apoyarte.',
  'Preocupado/a': 'No estás solo/a. Compartir lo que te preocupa alivia.',
  'Agradecido/a': 'Dile a tu pareja algo que aprecias de ella hoy.',
  'Travieso/a':   'Esa chispa es energía para conectar con tu pareja de un modo especial.',
  'Abrumado/a':   'Tómatelo con calma. Un paso a la vez, y no tienes que hacerlo solo/a.',
  'Motivado/a':   'Usa esa energía para algo que os acerque como pareja.',
};

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
async function initCheckin(router) {
  const user    = await auth.getUser();
  if (!user) return router.navigate('/onboarding/1');

  const couple  = await db.getMyCouple().catch(() => null);
  const partner = couple ? await db.getPartner().catch(() => null) : null;

  // ── Cargar check-in previo de hoy si existe ──────────────────
  let todayCheckin = null;
  if (couple) {
    try {
      const checkins  = await db.getTodayCheckins(couple.id);
      todayCheckin    = checkins.find(c => c.user_id === user.id) || null;
      const partnerChk= checkins.find(c => c.user_id !== user.id)  || null;

      // Mostrar estado de la pareja
      _updatePartnerCard(partner, partnerChk, !!todayCheckin);
    } catch (_) { /* silencioso */ }
  }

  // ── Selectores DOM ───────────────────────────────────────────
  const items       = document.querySelectorAll('#app .emoji-grid-item');
  const emotionName = qs('h2.text-primary');
  const confirmBtn  = qs('button.bg-primary');
  const apoyoCard   = qs('.bg-soft-teal');

  let selectedIdx = todayCheckin
    ? EMOTIONS.findIndex(e => e.emoji === todayCheckin.emoji)
    : -1;

  // ── Ocultar tarjeta de apoyo hasta que se seleccione emoción negativa
  if (apoyoCard && selectedIdx < 0) apoyoCard.style.display = 'none';

  // ── Tarjeta de pareja cuando no hay pareja vinculada ────────
  if (!couple) {
    _updatePartnerCardNone();
  }

  // ── Activar el emoji ya registrado hoy ───────────────────────
  if (selectedIdx >= 0) {
    _selectEmoji(items, emotionName, apoyoCard, selectedIdx);
  }

  // Desactivar el borde "pre-seleccionado" del HTML estático (😍)
  items.forEach((item, i) => {
    if (i !== selectedIdx) {
      item.classList.remove('border-primary');
      item.classList.add('border-transparent');
    }
  });

  // ── Click en cada emoji ──────────────────────────────────────
  items.forEach((item, i) => {
    item.addEventListener('click', () => {
      selectedIdx = i;
      _selectEmoji(items, emotionName, apoyoCard, i);
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '';
      }
    });
  });

  // ── Botón confirmar estado ───────────────────────────────────
  if (confirmBtn) {
    // Deshabilitar visualmente si no hay selección
    if (selectedIdx < 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.45';
    }

    confirmBtn.addEventListener('click', async () => {
      if (selectedIdx < 0) {
        showToast('Selecciona cómo te sientes', 'error');
        return;
      }

      if (!couple) {
        showToast('Vincula tu cuenta con tu pareja primero', 'neutral', 3000);
        router.navigate('/onboarding/5');
        return;
      }

      const emotion = EMOTIONS[selectedIdx];
      setButtonLoading(confirmBtn, true);

      try {
        await db.saveEmotionCheckin({
          coupleId:    couple.id,
          emoji:       emotion.emoji,
          emotionName: emotion.name,
        });

        showToast(`Estado guardado: ${emotion.emoji} ${emotion.name}`, 'success', 2000);

        // Recargar check-ins para mostrar el estado actualizado de la pareja
        const checkins   = await db.getTodayCheckins(couple.id);
        const partnerChk = checkins.find(c => c.user_id !== user.id) || null;
        _updatePartnerCard(partner, partnerChk, true);

        setTimeout(() => router.navigate('/home'), 1500);
      } catch (err) {
        setButtonLoading(confirmBtn, false);
        confirmBtn.style.opacity = '';
        showToast(err.message || 'Error al guardar', 'error');
      }
    });
  }

  // ── Back button (primer botón en el header) ──────────────────
  const backBtn = document.querySelector('#app header button');
  backBtn?.addEventListener('click', () => { history.back(); });
}

// ── Actualiza visualmente el emoji seleccionado ──────────────
function _selectEmoji(items, emotionNameEl, apoyoCardEl, idx) {
  // Quitar selección anterior
  items.forEach(item => {
    item.classList.remove('emoji-selected', 'border-primary', 'bg-primary\\/5');
    item.classList.add('border-transparent');
  });

  // Aplicar selección
  const selected = items[idx];
  if (selected) {
    selected.classList.add('emoji-selected', 'border-primary');
    selected.classList.remove('border-transparent');
  }

  // Actualizar nombre de emoción
  const emotion = EMOTIONS[idx];
  if (emotionNameEl && emotion) {
    emotionNameEl.textContent = emotion.name;
  }

  // Mostrar/ocultar tarjeta de apoyo (solo emociones negativas)
  if (apoyoCardEl && emotion) {
    const msg = SUPPORT_MESSAGES[emotion.name];
    if (msg) {
      const msgEl = apoyoCardEl.querySelector('p.text-primary.font-bold, p[class*="font-bold"]');
      if (msgEl) msgEl.textContent = msg;
      apoyoCardEl.style.display = '';
    } else {
      apoyoCardEl.style.display = 'none';
    }
  }
}

// ── Tarjeta de pareja cuando no hay pareja vinculada ─────────
function _updatePartnerCardNone() {
  const partnerCard = document.querySelector('#app .aspect-square.bg-white');
  if (!partnerCard) return;
  const nameLabel = partnerCard.querySelector('p[class*="text-\\[11px\\]"]');
  const statusTxt = partnerCard.querySelector('p[class*="font-bold"][class*="text-\\[17px\\]"]');
  const avatar    = partnerCard.querySelector('img');
  const emojiDot  = partnerCard.querySelector('[class*="absolute"]');
  if (nameLabel) nameLabel.textContent = 'SIN VINCULAR';
  if (statusTxt) statusTxt.textContent = 'Vincula tu pareja';
  if (emojiDot)  emojiDot.textContent  = '🔗';
  if (avatar) {
    avatar.src = '';
    avatar.style.display = 'none';
  }
}

// ── Actualiza la tarjeta de la pareja ────────────────────────
function _updatePartnerCard(partner, partnerCheckin, userHasDone) {
  const partnerCard = document.querySelector('#app .aspect-square.bg-white, #app .aspect-square.bg-white.dark\\:bg-slate-800');
  if (!partnerCard) return;

  // Nombre de la pareja
  const nameLabel = partnerCard.querySelector('p[class*="text-\\[11px\\]"]');
  const statusTxt = partnerCard.querySelector('p[class*="font-bold"][class*="text-\\[17px\\]"]');
  const avatar    = partnerCard.querySelector('img');
  const emojiDot  = partnerCard.querySelector('[class*="absolute"]');

  if (nameLabel && partner?.name) {
    nameLabel.textContent = partner.name.toUpperCase();
  }

  if (avatar && partner?.avatar_url) {
    avatar.src = partner.avatar_url;
    avatar.alt = partner.name || 'Pareja';
  }

  if (partnerCheckin) {
    // La pareja ya hizo check-in
    if (statusTxt) statusTxt.textContent = partnerCheckin.emotion_name;
    if (emojiDot)  emojiDot.textContent  = partnerCheckin.emoji;
    partnerCard.classList.remove('partner-answer-locked');
  } else if (userHasDone) {
    // El usuario ya hizo check-in pero la pareja no
    if (statusTxt) statusTxt.textContent = 'Aún no ha registrado';
    if (emojiDot)  emojiDot.textContent  = '⏳';
  } else {
    // El usuario no ha hecho check-in → ocultar estado de pareja (blur)
    if (statusTxt) {
      statusTxt.textContent = '?????';
      statusTxt.classList.add('partner-answer-locked');
    }
    if (emojiDot) {
      emojiDot.textContent = '🔒';
    }
  }
}

export const ROUTE_MAP = {
  '/checkin': { html: checkinRaw, init: initCheckin },
};
