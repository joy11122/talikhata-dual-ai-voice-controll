'use client';

/** Small browser-safe helpers for the Capacitor shell. */
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as Window & { Capacitor?: unknown }).Capacitor);
}

export async function setupNativeBackButton() {
  if (!isCapacitorApp()) return () => {};

  const { App } = await import('@capacitor/app');
  const registration = await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });

  return () => registration.remove();
}
