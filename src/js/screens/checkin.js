/**
 * EMOTIA — Pantalla Check-in Emocional con lógica real de Supabase
 */

import { auth, db } from '../../supabase.js';
import { showToast, setButtonLoading } from '../auth.js';
import { t } from '../i18n.js';

import checkinRaw from '../../../stitch_emotia/check_in_emojis_con_contenedores_ampliados/code.html?raw';

const qs = (sel) => document.querySelector(`#app ${sel}`);

// ── Definición de las 15 emociones (mismo orden que el HTML Stitch) ──
// Cada emoción tiene un id fijo; el nombre se traduce en tiempo de render via t()
const EMOTIONS = [
  { emoji: '😊', id: 'happy',        negative: false },
  { emoji: '😍', id: 'inLove',       negative: false },
  { emoji: '🤩', id: 'excited',      negative: false },
  { emoji: '😌', id: 'peaceful',     negative: false },
  { emoji: '🥰', id: 'affectionate', negative: false },
  { emoji: '🤔', id: 'thoughtful',   negative: false },
  { emoji: '😢', id: 'sad',          negative: true  },
  { emoji: '😰', id: 'anxious',      negative: true  },
  { emoji: '😤', id: 'angry',        negative: true  },
  { emoji: '😴', id: 'exhausted',    negative: true  },
  { emoji: '😟', id: 'worried',      negative: true  },
  { emoji: '🤗', id: 'grateful',     negative: false },
  { emoji: '😏', id: 'mischievous',  negative: false },
  { emoji: '😩', id: 'overwhelmed',  negative: true  },
  { emoji: '💪', id: 'motivated',    negative: false },
];

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
async function initCheckin(router) {
  const session = await auth.getSession().catch(() => null);
  const user    = session?.user ?? null;
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
        showToast(t('checkin.selectEmotion'), 'error');
        return;
      }

      if (!couple) {
        showToast(t('checkin.linkFirst'), 'neutral', 3000);
        router.navigate('/onboarding/5');
        return;
      }

      const emotion = EMOTIONS[selectedIdx];
      const emotionName = t(`emotions.${emotion.id}.name`);
      setButtonLoading(confirmBtn, true);

      try {
        await db.saveEmotionCheckin({
          coupleId:    couple.id,
          emoji:       emotion.emoji,
          emotionName: emotionName,
        });

        showToast(`${t('checkin.saved')} ${emotion.emoji} ${emotionName}`, 'success', 2000);

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
    emotionNameEl.textContent = t(`emotions.${emotion.id}.name`);
  }

  // Mostrar/ocultar tarjeta de apoyo
  if (apoyoCardEl && emotion) {
    const msg = t(`emotions.${emotion.id}.support`);
    if (msg && msg !== `emotions.${emotion.id}.support`) {
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
  if (nameLabel) nameLabel.textContent = t('checkin.noLinked');
  if (statusTxt) statusTxt.textContent = t('checkin.linkPartner');
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
    if (statusTxt) statusTxt.textContent = t('checkin.notRegistered');
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
