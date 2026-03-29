/**
 * EMOTIA — Utilidades de autenticación (capa UI)
 *
 * Este archivo solo contiene helpers de validación y presentación.
 * Las llamadas reales a Supabase van siempre en src/supabase.js.
 */

// ── Validación ──────────────────────────────────────────────

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

export function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 2;
}

export function validatePartnerCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code.toUpperCase());
}

// ── Mensajes de error en campos ─────────────────────────────

/**
 * Muestra un mensaje de error debajo de un input.
 * El input debe estar dentro de un contenedor directo (div.relative, etc.)
 */
export function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  const err = document.createElement('p');
  err.className = 'field-error';
  err.setAttribute('data-field-error', '1');
  err.textContent = message;
  // Insertar después del input o después de su contenedor directo
  const parent = inputEl.closest('div') || inputEl.parentElement;
  parent.after(err);
}

export function clearFieldError(inputEl) {
  const parent = inputEl.closest('div') || inputEl.parentElement;
  parent.parentElement?.querySelectorAll('[data-field-error]').forEach(el => el.remove());
}

export function clearAllErrors() {
  document.querySelectorAll('[data-field-error]').forEach(el => el.remove());
}

// ── Toast global ─────────────────────────────────────────────

export function showToast(message, type = 'neutral', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const colors = {
    neutral: 'bg-slate-900 text-white',
    success: 'bg-green-700 text-white',
    error:   'bg-red-600 text-white',
  };

  toast.innerHTML = `<div class="toast-pill ${colors[type] || colors.neutral}">${message}</div>`;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; toast.style.opacity = '1'; }, 300);
  }, duration);
}

// ── Loading states ────────────────────────────────────────────

export function setButtonLoading(btn, loading, originalText = null) {
  if (!btn) return;
  if (loading) {
    btn._originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <span class="material-symbols-outlined text-xl animate-spin">progress_activity</span>
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText || btn._originalHTML || btn.innerHTML;
  }
}

// ── Pantalla de carga global ──────────────────────────────────

export function showLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('fade-out');
    overlay.style.display = 'flex';
  }
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('fade-out');
  }, 300);
}

// ── Formateo de fechas ────────────────────────────────────────

/**
 * Calcula "X años y Y meses" desde una fecha ISO hasta hoy.
 */
export function timeTogether(isoDate) {
  if (!isoDate) return '';
  const start = new Date(isoDate);
  const now   = new Date();

  let years  = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days   = now.getDate() - start.getDate();

  if (days < 0)   { months--; }
  if (months < 0) { years--; months += 12; }

  if (years > 0 && months > 0) return `${years} año${years !== 1 ? 's' : ''} y ${months} mes${months !== 1 ? 'es' : ''}`;
  if (years > 0)               return `${years} año${years !== 1 ? 's' : ''}`;
  if (months > 0)              return `${months} mes${months !== 1 ? 'es' : ''}`;
  const diffDays = Math.floor((now - start) / 86400000);
  return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
}

/**
 * Parsea "DD/MM/AAAA" y devuelve "YYYY-MM-DD" para Supabase.
 * Devuelve null si el formato es inválido.
 */
export function parseDateInput(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
  const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

/**
 * Saludo dinámico basado en la hora actual.
 */
export function getTimeGreeting(name) {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return `Buenos días, ${name} ☀️`;
  if (h >= 12 && h < 20) return `Buenas tardes, ${name} 🌤`;
  return `Buenas noches, ${name} 🌙`;
}
