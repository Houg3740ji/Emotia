/**
 * EMOTIA — Sistema de retroalimentación háptica
 * Usa navigator.vibrate() en Android/Chrome.
 * En iOS Safari la vibración no está soportada por la Web API;
 * cuando migremos a Capacitor se usará el plugin de hápticos nativo.
 */

export const haptic = {
  /** Selects, toggles, tab taps — feedback mínimo */
  light: () => navigator.vibrate?.(10),

  /** Confirmaciones, envíos, inicio de acción importante */
  medium: () => navigator.vibrate?.(40),

  /** Acción completada con éxito */
  success: () => navigator.vibrate?.([50, 50, 50]),

  /** Match mutuo — el momento más especial */
  match: () => navigator.vibrate?.([80, 100, 80]),

  /** Error — feedback de rechazo */
  error: () => navigator.vibrate?.([100, 50, 100]),
};
