import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uz.agroalliance.app',
  appName: 'Agro Alliance',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  android: {
    // Android WebView'da localStorage/sessionStorage saqlanishi uchun
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
}

export default config
