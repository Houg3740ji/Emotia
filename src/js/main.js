/**
 * EMOTIA — Entry point principal
 *
 * Inicializa el router, escucha cambios de sesión y arranca la app.
 */

import { auth } from '../supabase.js';
import { router } from './router.js';
import { initAppPreferences } from './screens/secondary.js';

// ── Limpiar suscripciones real-time al cambiar de pantalla ──
function cleanupRealtime() {
  if (window._emotiaChannel) {
    window._emotiaChannel.unsubscribe();
    window._emotiaChannel = null;
  }
}

// ── Arrancar la app ──────────────────────────────────────────
async function init() {
  // Restaurar tema e idioma guardados antes de mostrar nada
  initAppPreferences();
  // Escuchar cambios de sesión globales (login / logout / expiración)
  auth.onAuthStateChange(async (event, session) => {
    console.log('[Emotia] Auth event:', event);

    if (event === 'SIGNED_OUT') {
      cleanupRealtime();
      router.navigate('/onboarding/1');
    }

    if (event === 'SIGNED_IN' && router.currentRoute?.startsWith('/onboarding/2')) {
      // Vino de OAuth (Google/Apple) → completar flujo
      cleanupRealtime();
      await router.start();
    }
  });

  // Arrancar: el router decide la ruta inicial
  await router.start();
}

init().catch(console.error);
