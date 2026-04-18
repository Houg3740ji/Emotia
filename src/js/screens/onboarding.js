/**
 * EMOTIA — Pantallas de Onboarding (pasos 1 al 5)
 *
 * Carga los HTML de Stitch + los dos nuevos con ?raw y conecta
 * cada pantalla a Supabase.
 */

import { supabase, auth as supabaseAuth, db, storage } from '../../supabase.js';
import {
  validateEmail, validatePassword, validateName, validatePartnerCode,
  showFieldError, clearAllErrors,
  showToast, setButtonLoading,
  timeTogether, parseDateInput,
} from '../auth.js';

// ── Importar HTML de los archivos Stitch y nuevos ────────────
import screen1Raw from '../../../stitch_emotia/onboarding_bienvenida_clean/code.html?raw';
import screen2Raw from '../../../stitch_emotia/registro_clean_sin_t_rminos/code.html?raw';
import screen3Raw from '../../../stitch_emotia/onboarding_perfil_cohesivo/code.html?raw';
import screen4Raw from '../../screens/onboarding4.html?raw';
import screen5Raw from '../../screens/onboarding5.html?raw';

// ── Helper: query dentro de #app ─────────────────────────────
const qs  = (sel) => document.querySelector(`#app ${sel}`);
const qsa = (sel) => document.querySelectorAll(`#app ${sel}`);


// ════════════════════════════════════════════════════════════
// PANTALLA 1 — Bienvenida
// ════════════════════════════════════════════════════════════
async function initScreen1(router) {
  document.getElementById('app').style.background = '#fdfaf5';

  // "Empezar" → pantalla de registro
  const startBtn = qs('button.bg-primary, button[class*="bg-primary"]');
  if (startBtn) {
    startBtn.addEventListener('click', () => router.navigate('/onboarding/2', { mode: 'register' }));
  }

  // "Ya tengo una cuenta" → pantalla de login
  const loginBtn = qs('button.text-slate-500');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => router.navigate('/onboarding/2', { mode: 'login' }));
  }
}


// ════════════════════════════════════════════════════════════
// PANTALLA 2 — Autenticación (registro / login)
// ════════════════════════════════════════════════════════════
async function initScreen2(router, params) {
  document.getElementById('app').style.background = '#fdfaf5';

  const mode = params?.mode || 'register';

  // ── Flecha atrás → volver a pantalla 1 ─────────────────────
  const backIcon = [...document.querySelectorAll('#app .material-symbols-outlined')]
    .find(el => el.textContent.trim() === 'arrow_back_ios_new');
  backIcon?.closest('div')?.addEventListener('click', () => router.navigate('/onboarding/1'));

  // ── Cambiar título según modo ───────────────────────────────
  const title = qs('h1');
  if (title) {
    title.innerHTML = mode === 'login'
      ? 'Iniciar sesión <span class="apple-emoji">👋</span>'
      : 'Únete a Emotia <span class="apple-emoji">🍎</span>';
  }

  // ── Añadir campo de contraseña dinámicamente ────────────────
  const emailInput  = qs('input[type="email"]');
  const submitBtn   = qs('button.bg-primary');
  if (!emailInput || !submitBtn) return;

  // Insertar password después del contenedor del email
  const emailContainer = emailInput.closest('div.relative') || emailInput.parentElement;
  const pwdWrapper     = document.createElement('div');
  pwdWrapper.className = 'relative';
  pwdWrapper.innerHTML = `
    <input
      id="password-input"
      class="w-full h-14 px-5 rounded-full border-slate-100 bg-white
             focus:border-primary focus:ring-primary text-slate-900
             placeholder:text-slate-400 transition-all border shadow-sm
             focus:shadow-lg focus:shadow-primary/5 pr-14"
      placeholder="Contraseña (mín. 6 caracteres)"
      type="password"
      autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"
    />
    <button type="button" id="toggle-pwd"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400
                   hover:text-slate-600 transition-colors">
      <span class="material-symbols-outlined text-xl">visibility</span>
    </button>
  `;
  emailContainer.after(pwdWrapper);

  const pwdInput  = document.getElementById('password-input');
  const toggleBtn = document.getElementById('toggle-pwd');

  // Toggle visibilidad contraseña
  toggleBtn?.addEventListener('click', () => {
    const isText = pwdInput.type === 'text';
    pwdInput.type = isText ? 'password' : 'text';
    toggleBtn.querySelector('.material-symbols-outlined').textContent =
      isText ? 'visibility' : 'visibility_off';
  });

  // ── Actualizar texto del botón submit ───────────────────────
  if (submitBtn) {
    submitBtn.textContent = mode === 'login' ? 'Entrar' : 'Crear cuenta';
  }

  // ── Añadir enlace de alternar modo ──────────────────────────
  const toggleLink = document.createElement('p');
  toggleLink.className = 'text-center text-slate-500 text-sm mt-2';
  toggleLink.innerHTML = mode === 'login'
    ? '¿No tienes cuenta? <span id="toggle-mode" class="text-primary font-semibold cursor-pointer">Regístrate</span>'
    : '¿Ya tienes cuenta? <span id="toggle-mode" class="text-primary font-semibold cursor-pointer">Inicia sesión</span>';
  submitBtn.after(toggleLink);

  document.getElementById('toggle-mode')?.addEventListener('click', () => {
    router.navigate('/onboarding/2', { mode: mode === 'login' ? 'register' : 'login' });
  });

  // ── Olvidé mi contraseña (solo en login) ───────────────────
  if (mode === 'login') {
    const forgotLink = document.createElement('p');
    forgotLink.className = 'text-center text-slate-400 text-xs mt-1 cursor-pointer hover:text-primary transition-colors';
    forgotLink.textContent = 'Olvidé mi contraseña';
    forgotLink.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!validateEmail(email)) {
        showToast('Introduce tu email para recuperar la contraseña', 'error');
        return;
      }
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'com.emotia.app://auth/reset-password',
        });
        if (error) throw error;
        showToast('Email de recuperación enviado ✓', 'success');
      } catch (err) {
        showToast(err.message || 'Error al enviar email', 'error');
      }
    });
    toggleLink.after(forgotLink);
  }

  // ── OAuth: Google ───────────────────────────────────────────
  // El botón de Google tiene border-slate-100 como clase distintiva
  const googleBtn = qs('button[class*="border-slate-100"]');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      setButtonLoading(googleBtn, true);
      try {
        await supabaseAuth.signInWithGoogle();
        // La redirección la maneja Supabase OAuth + onAuthStateChange
      } catch (err) {
        setButtonLoading(googleBtn, false);
        showToast(err.message || 'Error con Google', 'error');
      }
    });
  }

  // ── OAuth: Apple ────────────────────────────────────────────
  const appleBtn = qs('button[class*="bg-slate-900"]');
  if (appleBtn) {
    appleBtn.addEventListener('click', async () => {
      setButtonLoading(appleBtn, true);
      try {
        await supabaseAuth.signInWithApple();
      } catch (err) {
        setButtonLoading(appleBtn, false);
        showToast(err.message || 'Error con Apple', 'error');
      }
    });
  }

  // ── Submit email + contraseña ───────────────────────────────
  submitBtn.addEventListener('click', async () => {
    clearAllErrors();

    const email    = emailInput.value.trim();
    const password = pwdInput?.value || '';

    let hasError = false;

    if (!validateEmail(email)) {
      showFieldError(emailInput, 'Introduce un email válido');
      hasError = true;
    }
    if (!validatePassword(password)) {
      showFieldError(pwdInput, 'La contraseña debe tener al menos 6 caracteres');
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true);

    try {
      if (mode === 'register') {
        await supabaseAuth.signUp({ email, password, name: '' });
        showToast('Cuenta creada. Ahora completa tu perfil 🎉', 'success', 2500);
        router.navigate('/onboarding/3');
      } else {
        await supabaseAuth.signIn({ email, password });
        // El router.start() en main.js detectará el estado y redirigirá
        await router.start();
      }
    } catch (err) {
      setButtonLoading(submitBtn, false);
      const msg = _translateAuthError(err.message);
      showToast(msg, 'error');
    }
  });

  // Enter en el campo de contraseña también envía
  pwdInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });
}

/** Traduce mensajes de error de Supabase Auth al español */
function _translateAuthError(msg) {
  if (!msg) return 'Error de autenticación';
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos';
  if (msg.includes('User already registered'))   return 'Este email ya tiene una cuenta';
  if (msg.includes('Email not confirmed'))        return 'Confirma tu email antes de entrar';
  if (msg.includes('Password should be'))        return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit'))                 return 'Demasiados intentos. Espera un momento';
  return msg;
}


// ════════════════════════════════════════════════════════════
// PANTALLA 3 — Nombre + Fecha de aniversario
// ════════════════════════════════════════════════════════════
async function initScreen3(router) {
  const nameInput    = qs('input[placeholder="Nombre"]');
  const dateInput    = qs('input[placeholder="DD/MM/AAAA"]');
  const previewEl    = qs('.text-primary.font-medium.text-xs');
  const togetherEl   = qs('.text-primary.font-bold');
  const continueBtn  = qs('button.bg-primary');

  if (!nameInput || !continueBtn) return;

  // Prellenar con datos existentes si los hay
  try {
    const profile = await db.getMyProfile();
    if (profile?.name) {
      nameInput.value = profile.name;
      if (previewEl) previewEl.textContent = `Hola, ${profile.name} 👋`;
    }
  } catch (_) { /* silencioso */ }

  // Limpiar valores hardcodeados
  if (dateInput?.value === '12/11/2021') dateInput.value = '';

  // ── Live preview del nombre ─────────────────────────────────
  nameInput.addEventListener('input', () => {
    const val = nameInput.value.trim();
    if (previewEl) previewEl.textContent = val ? `Hola, ${val} 👋` : '';
  });

  // ── Cálculo automático "lleváis juntos X" ───────────────────
  dateInput?.addEventListener('input', () => {
    const iso = parseDateInput(dateInput.value);
    if (iso && togetherEl) {
      const together = timeTogether(iso);
      togetherEl.textContent = together;
      togetherEl.closest('p').style.display = 'flex';
    } else if (togetherEl?.closest('p')) {
      togetherEl.closest('p').style.display = 'none';
    }
  });

  // Formatear automáticamente la fecha mientras escribe (DD/MM/AAAA)
  dateInput?.addEventListener('keyup', () => {
    let val = dateInput.value.replace(/\D/g, '');
    if (val.length > 2)  val = val.slice(0,2) + '/' + val.slice(2);
    if (val.length > 5)  val = val.slice(0,5) + '/' + val.slice(5);
    if (val.length > 10) val = val.slice(0,10);
    dateInput.value = val;
  });

  // ── Continuar ───────────────────────────────────────────────
  continueBtn.addEventListener('click', async () => {
    clearAllErrors();

    const name = nameInput.value.trim();
    const isoDate = dateInput?.value ? parseDateInput(dateInput.value) : null;

    if (!validateName(name)) {
      showFieldError(nameInput, 'El nombre debe tener al menos 2 caracteres');
      return;
    }

    setButtonLoading(continueBtn, true);

    try {
      // Guardar nombre en Supabase
      await db.updateMyProfile({ name });

      // Guardar fecha de aniversario en localStorage (se aplica al crear pareja en paso 5)
      if (isoDate) localStorage.setItem('emotia_anniversary', isoDate);

      router.navigate('/onboarding/4');
    } catch (err) {
      setButtonLoading(continueBtn, false);
      showToast(err.message || 'Error al guardar', 'error');
    }
  });
}


// ════════════════════════════════════════════════════════════
// PANTALLA 4 — Foto de perfil
// ════════════════════════════════════════════════════════════
async function initScreen4(router) {
  const circle      = qs('#avatar-circle');
  const fileInput   = qs('#avatar-file-input');
  const preview     = qs('#avatar-preview');
  const icon        = qs('#avatar-icon');
  const skipBtn     = qs('#skip-photo-btn');
  const continueBtn = qs('#continue-btn');
  const statusEl    = qs('#upload-status');
  const errorEl     = qs('#upload-error');

  let uploadedUrl = null;

  // Mostrar foto actual si ya tiene
  try {
    const profile = await db.getMyProfile();
    if (profile?.avatar_url) {
      uploadedUrl = profile.avatar_url;
      _showAvatar(preview, icon, profile.avatar_url);
    }
  } catch (_) { /* silencioso */ }

  // Click en el círculo → abrir selector de archivo
  circle?.addEventListener('click', () => fileInput?.click());

  // Al seleccionar un archivo
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vista previa local inmediata
    const localUrl = URL.createObjectURL(file);
    _showAvatar(preview, icon, localUrl);

    // Subir a Supabase Storage
    if (statusEl) statusEl.classList.remove('hidden');
    if (errorEl)  errorEl.classList.add('hidden');

    try {
      uploadedUrl = await storage.uploadAvatar(file);
      await db.updateMyProfile({ avatar_url: uploadedUrl });
      showToast('Foto guardada ✓', 'success', 1500);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error al subir la foto. Puedes continuar sin ella.';
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (statusEl) statusEl.classList.add('hidden');
    }
  });

  // Saltar
  skipBtn?.addEventListener('click', () => router.navigate('/onboarding/5'));

  // Continuar (con o sin foto)
  continueBtn?.addEventListener('click', () => router.navigate('/onboarding/5'));
}

function _showAvatar(previewImg, iconEl, url) {
  if (previewImg) { previewImg.src = url; previewImg.classList.remove('hidden'); }
  if (iconEl)     { iconEl.classList.add('hidden'); }
}


// ════════════════════════════════════════════════════════════
// PANTALLA 5 — Código de pareja (6 cajas OTP-style)
// ════════════════════════════════════════════════════════════
async function initScreen5(router) {
  const myBoxes    = qsa('#my-code-boxes .code-char');
  const copyBtn    = qs('#copy-code-btn');
  const shareBtn   = qs('#share-code-btn');
  const inputs     = qsa('#partner-code-boxes .code-input-box');
  const errorEl    = qs('#partner-code-error');
  const errorMsg   = qs('#partner-error-msg');
  const successEl  = qs('#partner-code-success');
  const linkBtn    = qs('#link-btn');
  const skipBtn    = qs('#skip-link-btn');
  const loadingEl  = qs('#link-loading');

  let myCode = '';

  // ── Cargar y mostrar el código propio en 6 cajas ─────────
  try {
    const profile = await db.getMyProfile();
    myCode = profile?.partner_code || '';
    if (myCode && myBoxes.length === 6) {
      myCode.split('').forEach((ch, i) => {
        if (myBoxes[i]) myBoxes[i].textContent = ch;
      });
    }
  } catch (_) { /* silencioso */ }

  // ── Copiar código ─────────────────────────────────────────
  copyBtn?.addEventListener('click', async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      showToast('Código copiado ✓', 'success', 1500);
    } catch (_) {
      showToast(`Tu código: ${myCode}`, 'neutral', 3000);
    }
  });

  // ── Compartir código (Web Share API, fallback a copiar) ───
  shareBtn?.addEventListener('click', async () => {
    if (!myCode) return;
    const text = `Mi código de Emotia es: ${myCode} — úsalo para conectarnos 💚`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch (_) { /* cancelado */ }
    } else {
      try { await navigator.clipboard.writeText(text); showToast('Texto copiado ✓', 'success', 1500); }
      catch (_) { showToast(text, 'neutral', 4000); }
    }
  });

  // ── Helpers para las 6 cajas de input ────────────────────
  function getPartnerCode() {
    return Array.from(inputs).map(i => i.value.toUpperCase()).join('');
  }

  function setBoxState(state) {
    // state: 'neutral' | 'error' | 'success'
    inputs.forEach(inp => {
      inp.classList.remove('filled', 'error', 'success');
      if (inp.value) inp.classList.add(state === 'neutral' ? 'filled' : state);
    });
  }

  function clearFeedback() {
    errorEl?.classList.add('hidden');
    successEl?.classList.add('hidden');
  }

  function showError(msg) {
    if (errorMsg)  errorMsg.textContent = msg;
    errorEl?.classList.remove('hidden');
    successEl?.classList.add('hidden');
    setBoxState('error');
  }

  function checkAllFilled() {
    const code = getPartnerCode();
    if (linkBtn) linkBtn.disabled = code.length < 6;
    if (code.length === 6) setBoxState('filled');
    return code.length === 6;
  }

  // ── Comportamiento OTP: auto-avance, retroceso, pegar ────
  inputs.forEach((inp, idx) => {
    // Al escribir un carácter: normalizarlo y avanzar al siguiente
    inp.addEventListener('input', (e) => {
      // Mantener solo alfanumérico, mayúscula
      const val = inp.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      inp.value = val ? val[val.length - 1] : '';

      clearFeedback();

      if (inp.value && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
      checkAllFilled();
    });

    // Backspace: borrar caja actual o ir a la anterior
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (!inp.value && idx > 0) {
          inputs[idx - 1].value = '';
          inputs[idx - 1].focus();
        } else {
          inp.value = '';
        }
        clearFeedback();
        setBoxState('neutral');
        if (linkBtn) linkBtn.disabled = true;
        e.preventDefault();
      }
      // Enter → submit si está listo
      if (e.key === 'Enter' && !linkBtn?.disabled) linkBtn?.click();
    });

    // Pegar: distribuir caracteres en las cajas
    inp.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6);
      if (!pasted) return;
      pasted.split('').forEach((ch, i) => {
        if (inputs[i]) inputs[i].value = ch;
      });
      const nextEmpty = inputs[pasted.length] || inputs[inputs.length - 1];
      nextEmpty?.focus();
      clearFeedback();
      checkAllFilled();
    });
  });

  // Focus en la primera caja al cargar
  inputs[0]?.focus();

  // ── Vincular con pareja ───────────────────────────────────
  linkBtn?.addEventListener('click', async () => {
    const code = getPartnerCode();
    if (!validatePartnerCode(code)) {
      showError('El código debe tener 6 caracteres alfanuméricos');
      return;
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (linkBtn)   linkBtn.disabled = true;
    clearFeedback();

    try {
      const couple = await db.linkWithPartner(code);

      // Aplicar fecha de aniversario guardada en paso 3
      const anniversary = localStorage.getItem('emotia_anniversary');
      if (anniversary && couple?.id) {
        await db.updateAnniversary(couple.id, anniversary);
        localStorage.removeItem('emotia_anniversary');
      }

      if (loadingEl) loadingEl.classList.add('hidden');
      setBoxState('success');
      successEl?.classList.remove('hidden');
      errorEl?.classList.add('hidden');
      showToast('¡Pareja vinculada! 🎉', 'success', 2000);

      setTimeout(() => router.navigate('/home'), 1600);

    } catch (err) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (linkBtn)   linkBtn.disabled = false;

      const msg = (err.message?.includes('not found') || err.message?.includes('no encontrado'))
        ? 'Código no encontrado. Revísalo con tu pareja'
        : err.message || 'Error al vincular. Inténtalo de nuevo';

      showError(msg);
    }
  });

  // ── Saltar ────────────────────────────────────────────────
  skipBtn?.addEventListener('click', () => {
    localStorage.removeItem('emotia_anniversary');
    router.navigate('/home');
  });
}


// ════════════════════════════════════════════════════════════
// EXPORTACIÓN
// ════════════════════════════════════════════════════════════
export const ROUTE_MAP = {
  '/onboarding/1': { html: screen1Raw, init: initScreen1 },
  '/onboarding/2': { html: screen2Raw, init: initScreen2 },
  '/onboarding/3': { html: screen3Raw, init: initScreen3 },
  '/onboarding/4': { html: screen4Raw, init: initScreen4 },
  '/onboarding/5': { html: screen5Raw, init: initScreen5 },
};
