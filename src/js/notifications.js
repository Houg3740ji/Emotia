import { LocalNotifications } from '@capacitor/local-notifications';

const NOTIF_IDS = {
  DAILY_QUESTION:   1001,
  DAILY_MOOD:       1002,
  STREAK_QUESTION:  2001,
  STREAK_MOOD:      2002,
};

export async function requestNotifPermissions() {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (_) { return false; }
}

// Hora aleatoria dentro de un rango [startH, endH)
function randomTimeToday(startH, endH) {
  const d = new Date();
  d.setHours(startH + Math.floor(Math.random() * (endH - startH)), Math.floor(Math.random() * 60), 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

// Programa los recordatorios diarios (pregunta y estado de ánimo)
export async function scheduleDailyReminders(t) {
  try {
    await LocalNotifications.cancel({ notifications: [
      { id: NOTIF_IDS.DAILY_QUESTION },
      { id: NOTIF_IDS.DAILY_MOOD },
    ]});

    await LocalNotifications.schedule({ notifications: [
      {
        id:    NOTIF_IDS.DAILY_QUESTION,
        title: '💬 ' + (t?.('notif.questionTitle') ?? 'Pregunta del día'),
        body:  t?.('notif.questionBody') ?? 'Ya tienes una nueva pregunta esperándote',
        schedule: { at: randomTimeToday(9, 12), allowWhileIdle: true },
        sound:  null,
        smallIcon: 'ic_stat_icon',
      },
      {
        id:    NOTIF_IDS.DAILY_MOOD,
        title: '🫀 ' + (t?.('notif.moodTitle') ?? '¿Cómo te sientes hoy?'),
        body:  t?.('notif.moodBody') ?? 'Registra tu estado emocional del día',
        schedule: { at: randomTimeToday(12, 15), allowWhileIdle: true },
        sound:  null,
        smallIcon: 'ic_stat_icon',
      },
    ]});
  } catch (_) { /* silencioso */ }
}

// Programa aviso 30 min antes de medianoche si la racha está en riesgo
export async function scheduleStreakWarnings({ questionDone, moodDone }, t) {
  try {
    await LocalNotifications.cancel({ notifications: [
      { id: NOTIF_IDS.STREAK_QUESTION },
      { id: NOTIF_IDS.STREAK_MOOD },
    ]});

    const warningTime = new Date();
    warningTime.setHours(23, 30, 0, 0);
    if (warningTime <= new Date()) return;

    const notifs = [];

    if (!questionDone) notifs.push({
      id:    NOTIF_IDS.STREAK_QUESTION,
      title: '🔥 ' + (t?.('notif.streakTitle') ?? '¡Tu racha está en peligro!'),
      body:  t?.('notif.streakQuestion') ?? 'Responde la pregunta del día antes de medianoche',
      schedule: { at: warningTime, allowWhileIdle: true },
      sound: null,
    });

    if (!moodDone) notifs.push({
      id:    NOTIF_IDS.STREAK_MOOD,
      title: '🔥 ' + (t?.('notif.streakTitle') ?? '¡Tu racha está en peligro!'),
      body:  t?.('notif.streakMood') ?? 'Registra tu estado emocional antes de medianoche',
      schedule: { at: warningTime, allowWhileIdle: true },
      sound: null,
    });

    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  } catch (_) { /* silencioso */ }
}

// Notificación inmediata de actividad de la pareja
export async function notifyPartnerActivity(title, body) {
  try {
    await LocalNotifications.schedule({ notifications: [{
      id:    Date.now() % 2147483647,
      title,
      body,
      schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true },
      sound: null,
    }]});
  } catch (_) { /* silencioso */ }
}
