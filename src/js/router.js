/**
 * EMOTIA — Router SPA
 *
 * Gestiona la navegación entre pantallas sin recargar la página.
 * Cada pantalla es HTML extraído de los archivos Stitch + lógica JS.
 */

import { auth, db } from '../supabase.js';
import { hideLoadingOverlay, showToast } from './auth.js';
import { t, applyI18n } from './i18n.js';
import { haptic } from './haptics.js';

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

      // ── Inyectar y mostrar inmediatamente ────────────────────
      const app = document.getElementById('app');
      app.className        = `screen-enter ${bodyClass}`;
      app.style.opacity    = '1';
      app.style.transition = 'none';
      app.style.background = '';
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

      // Restaurar el tab bar a tamaño completo en cada navegación
      const tabNav = document.getElementById('tab-bar');
      tabNav?._tabRestore?.();

      // ── init() corre en segundo plano; ya rellenará los datos ─
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
        haptic.light();
        const icon = el.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.classList.remove('tab-bounce');
          void icon.offsetWidth;
          icon.classList.add('tab-bounce');
          icon.addEventListener('animationend', () => icon.classList.remove('tab-bounce'), { once: true });
        }
        this.navigate(ROUTES[i]);
      });
    });

    // Inicializar comportamiento idle (solo una vez)
    this._initTabIdleBehavior(nav);
  },

  // ── Efecto Instagram: minimiza el tab bar cuando no se usa ───
  _initTabIdleBehavior(nav) {
    const IDLE_MS   = 3400;  // tiempo de inactividad antes de minimizar
    const SCALE_MIN = 0.80;  // escala minimizada
    const OPAC_MIN  = 0.48;  // opacidad minimizada
    let timer       = null;
    let minimized   = false;

    const minimize = () => {
      if (minimized || nav.style.display === 'none') return;
      minimized = true;
      // Easing suave para entrar en segundo plano
      nav.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, box-shadow 0.5s ease';
      nav.style.transform  = `translateX(-50%) scale(${SCALE_MIN})`;
      nav.style.opacity    = String(OPAC_MIN);
      nav.style.boxShadow  = '0 2px 12px rgba(0,0,0,0.06)';
    };

    const restore = () => {
      minimized = false;
      // Spring bounce al volver a primer plano
      nav.style.transition = 'transform 0.52s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease, box-shadow 0.35s ease';
      nav.style.transform  = 'translateX(-50%) scale(1)';
      nav.style.opacity    = '1';
      nav.style.boxShadow  = '';
      clearTimeout(timer);
      timer = setTimeout(minimize, IDLE_MS);
    };

    const onActivity = () => {
      if (nav.style.display === 'none') return;
      if (minimized) {
        restore();
      } else {
        clearTimeout(timer);
        timer = setTimeout(minimize, IDLE_MS);
      }
    };

    // Cualquier interacción con la pantalla reactiva el tab bar
    document.addEventListener('touchstart', onActivity, { passive: true });
    document.addEventListener('touchend',   onActivity, { passive: true });
    document.addEventListener('scroll',     onActivity, { passive: true, capture: true });
    document.addEventListener('click',      onActivity, { passive: true });

    // Exponer la función de restauración para que el router la llame al navegar
    nav._tabRestore = restore;

    // Primer timer: dar 1.5 s de margen antes de minimizar por primera vez
    timer = setTimeout(minimize, IDLE_MS + 1500);
  },
};

// ── Manejar botón Atrás del navegador ───────────────────────
window.addEventListener('popstate', (e) => {
  const path = e.state?.path || window.location.hash.slice(1) || '/home';
  router.navigate(path);
});
