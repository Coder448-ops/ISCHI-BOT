import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'uz.ischi.industrial',
  appName: 'ISCHI Industrial',
  webDir: 'dist-mobile',
  backgroundColor: '#191d1b',
  android: {
    backgroundColor: '#191d1b',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: false,
      backgroundColor: '#191d1b',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: { style: 'DARK', backgroundColor: '#191d1b', overlaysWebView: false },
    Keyboard: { resizeOnFullScreen: true },
  },
};
export default config;
