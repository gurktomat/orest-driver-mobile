import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orestexpress.driver',
  appName: 'Orest Driver',
  // Capacitor needs a webDir to bundle a tiny bootstrapper HTML.
  // The actual driver app lives at https://orestexpress.online/driver — see
  // server.url below. The bootstrapper just hard-redirects to it on first
  // open so the native shell never holds stale UI bytes; UI updates ship
  // via the existing web deploy pipeline (no APK rebuild needed).
  webDir: 'web',
  bundledWebRuntime: false,
  server: {
    // Production driver portal. Capacitor loads this URL inside the WebView
    // and the existing PWA service worker handles offline + caching.
    url: 'https://orestexpress.online/driver/dashboard',
    cleartext: false,
    androidScheme: 'https',
    // Allow our domain + Samsara map tiles + any other API hosts the
    // PWA already talks to.
    allowNavigation: [
      'orestexpress.online',
      '*.orestexpress.online',
      'api.samsara.com',
      'api.tomtom.com',
      'api.mapbox.com',
    ],
  },
  android: {
    allowMixedContent: false,
    // Keep the WebView debuggable in non-release builds so we can inspect
    // it from chrome://inspect on a paired phone.
    webContentsDebuggingEnabled: true,
    // Prevent the OS from killing the WebView process when memory is tight.
    backgroundColor: '#0d0f14',
  },
  plugins: {
    PushNotifications: {
      // FCM token is requested at app start; tokens are sent to our backend
      // via /api/v1/driver-portal/fcm/subscribe (separate from web push).
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0d0f14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#0d0f14',
      style: 'DARK',
    },
  },
};

export default config;
