/**
 * EMOTIA — Router SPA
 *
 * Gestiona la navegación entre pantallas sin recargar la página.
 * Cada pantalla es HTML extraído de los archivos Stitch + lógica JS.
 */

import { auth, db } from '../supabase.js';
import { hideLoadingOverlay, showToast } from './auth.js';
import { t, applyI18n } from './i18n.js';

// Rutas públicas (no requieren sesión activa)
// Las rutas 3-5 son parte del flujo de registro: si la confirmación de email
// está activa en Supabase, signUp() devuelve session=null y el guard bloquearía
// la navegación. RLS en Supabase protege los datos de cada pantalla.
const PUBLIC_ROUTES = new Set([
  '/onboarding/1',
  '/onboarding/2',
  '/onboarding/3',
  '/onboarding/4',
  '/onboarding/5',
]);

// ── Extrae el contenido del <body> de un HTML crudo ──────────
function extractScreen(rawHtml) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(rawHtml, 'text/html');
  return {
    bodyClass: doc.body.getAttribute('class') || '',
    content:   doc.body.innerHTML,
  };
}

// ── Carga lazy de módulos de pantalla ─────────────────────────
// Cada módulo exporta ROUTE_MAP: { [path]: { html, init } }
const MODULE_LOADERS = {
  '/onboarding/1': () => import('./screens/onboarding.js'),
  '/onboarding/2': () => import('./screens/onboarding.js'),
  '/onboarding/3': () => import('./screens/onboarding.js'),
  '/onboarding/4': () => import('./screens/onboarding.js'),
  '/onboarding/5': () => import('./screens/onboarding.js'),
  '/home':            () => import('./screens/home.js'),
  '/checkin':         () => import('./screens/checkin.js'),
  '/reflexion':       () => import('./screens/secondary.js'),
  '/capsulas':             () => import('./screens/secondary.js'),
  '/capsulas/grabar':      () => import('./screens/secondary.js'),
  '/capsulas/reproducir':  () => import('./screens/secondary.js'),
  '/intimo':          () => import('./screens/secondary.js'),
  '/ruleta':          () => import('./screens/secondary.js'),
  '/tareas':          () => import('./screens/secondary.js'),
  '/notas':           () => import('./screens/secondary.js'),
};

// ── Router principal ─────────────────────────────────────────
export const router = {
  currentRoute: null,
  _params:      {},

  /**
   * Navega a una ruta SPA.
   * @param {string} path  - Ruta, e.g. '/home', '/onboarding/1'
   * @param {Object} params - Parámetros opcionales para la pantalla
   */
  async navigate(path, params = {}) {
    this._params = params;

    // ── Guard de autenticación ────────────────────────────────
    if (!PUBLIC_ROUTES.has(path)) {
      const session = await auth.getSession();
      if (!session) {
        console.log('[Router] Sin sesión → onboarding/1');
        return this.navigate('/onboarding/1');
      }
    }

    // ── Cargar módulo de pantalla ─────────────────────────────
    const loader = MODULE_LOADERS[path];
    if (!loader) {
      console.error('[Router] Ruta desconocida:', path);
      return this.navigate('/home');
    }

    try {
      const module = await loader();
      const route  = module.ROUTE_MAP?.[path];

      if (!route) {
        console.error('[Router] No hay ROUTE_MAP para:', path);
        return;
      }

      const { html, init } = route;
      const { bodyClass, content } = extractScreen(html);

      // ── Inyectar HTML y mostrar inmediatamente ───────────────
      const app = document.getElementById('app');
      app.className        = `screen-enter ${bodyClass}`;
      app.style.opacity    = '1';
      app.style.transition = 'none';
      app.innerHTML        = content;

      // Aplicar traducciones al DOM recién inyectado
      applyI18n();

      // Tailwind CDN puede necesitar un re-scan tras inyección dinámica
      if (typeof window.tailwind?.refresh === 'function') {
        window.tailwind.refresh();
      }

      this.currentRoute = path;

      // Actualizar hash sin disparar popstate (histórico)
      const hashPath = '#' + path;
      if (window.location.hash !== hashPath) {
        history.pushState({ path }, '', hashPath);
      }

      // ── Tab bar persistente: mostrar/ocultar y sincronizar ───
      this.wireTabBar();
      this._syncTabBar(path);

      // ── Ejecutar init en segundo plano (actualiza datos en el DOM) ──
      if (typeof init === 'function') {
        init(this, params).catch(err => console.error('[Router] Error en init:', err));
      }

    } catch (err) {
      console.error('[Router] Error cargando pantalla:', path, err);
      // Mostrar error mínimo al usuario
      document.getElementById('app').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:2rem;text-align:center;">
          <div>
            <p style="color:#dc2626;font-weight:700;margin-bottom:0.5rem;">${t('router.loadError')}</p>
            <p style="color:#64748b;font-size:0.875rem;">${err.message || t('router.unknownError')}</p>
            <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#0d968b;color:white;border:none;border-radius:9999px;cursor:pointer;font-weight:600;">
              ${t('router.retry')}
            </button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Determina la ruta inicial en función del estado de autenticación.
   * Llamado una sola vez al arrancar la app.
   */
  async start() {
    try {
      const session = await auth.getSession();

      if (!session) {
        hideLoadingOverlay();
        return this.navigate('/onboarding/1');
      }

      // Sesión activa — verificar si el perfil está completo
      const profile = await db.getMyProfile();
      if (!profile?.name || profile.name.length < 2) {
        hideLoadingOverlay();
        return this.navigate('/onboarding/3');
      }

      // Verificar si tiene pareja vinculada
      const couple = await db.getMyCouple();
      if (!couple) {
        hideLoadingOverlay();
        return this.navigate('/onboarding/5');
      }

      hideLoadingOverlay();
      return this.navigate('/home');

    } catch (err) {
      console.error('[Router] Error en start():', err);
      hideLoadingOverlay();
      return this.navigate('/onboarding/1');
    }
  },

  /** Devuelve los parámetros de la navegación actual */
  getParams() { return this._params; },

  // Rutas que muestran el tab bar
  _TAB_ROUTES: new Set(['/home', '/capsulas', '/capsulas/grabar', '/intimo', '/ruleta']),

  // Qué índice corresponde a cada ruta (4 tabs: home, capsulas, intimo, ruleta)
  _TAB_INDEX: { '/home': 0, '/capsulas': 1, '/capsulas/grabar': 1, '/intimo': 2, '/ruleta': 3 },

  _syncTabBar(path) {
    const nav = document.getElementById('tab-bar');
    if (!nav) return;

    // Mostrar u ocultar según la ruta
    nav.style.display = this._TAB_ROUTES.has(path) ? '' : 'none';

    const activeIdx = this._TAB_INDEX[path] ?? -1;
    Array.from(nav.children).forEach((el, i) => {
      el.classList.toggle('text-primary',   i === activeIdx);
      el.classList.toggle('text-slate-400', i !== activeIdx);
      const icon = el.querySelector('.material-symbols-outlined');
      if (icon) icon.classList.toggle('fill-icon', i === activeIdx);
    });
  },

  wireTabBar() {
    const nav = document.getElementById('tab-bar');
    if (!nav || nav.dataset.wired) return;
    nav.dataset.wired = '1';

    const ROUTES = ['/home', '/capsulas', '/intimo', '/ruleta'];
    Array.from(nav.children).forEach((el, i) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(ROUTES[i]);
      });
    });
  },
};

// ── Manejar botón Atrás del navegador ───────────────────────
window.addEventListener('popstate', (e) => {
  const path = e.state?.path || window.location.hash.slice(1) || '/home';
  router.navigate(path);
});
