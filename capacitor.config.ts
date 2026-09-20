
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * TaliKhata Voice — Capacitor configuration.
 *
 * The Next.js application remains the backend/web application.
 * The native shell loads the deployed HTTPS application URL,
 * so MongoDB credentials and Auth.js secrets are never shipped
 * inside the APK/IPA.
 *
 * Set CAP_SERVER_URL when building the native application:
 *
 * CAP_SERVER_URL=https://your-domain.com
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.talikhata.voice',
  appName: 'TaliKhata Voice',

  /**
   * Required by Capacitor CLI.
   * The native shell primarily loads the remote Next.js application
   * when CAP_SERVER_URL is configured.
   */
  webDir: 'public',

  /**
   * Load the deployed Next.js application when a server URL
   * is provided.
   */
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext:
            serverUrl.startsWith('http://localhost') ||
            serverUrl.startsWith('http://10.') ||
            serverUrl.startsWith('http://192.168.'),
        },
      }
    : {}),

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      showSpinner: false,
    },

    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
