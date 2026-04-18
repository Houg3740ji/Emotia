import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emotia.app',
  appName: 'Emotia',
  // Capacitor sirve el contenido desde la carpeta de build de Vite
  webDir: 'dist',
  server: {
    // iOS requiere HTTPS para Supabase y APIs externas
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      // Fondo crema de Emotia
      backgroundColor: '#FFFBF7',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      // Barra de estado oscura sobre fondo claro
      style: 'DARK',
      backgroundColor: '#FFFBF7',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#0d968b',
      sound: null,
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
