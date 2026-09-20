'use client';

import { useEffect } from 'react';
import { setupNativeBackButton } from '@/lib/mobile/capacitor';

export default function NativeShell() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void setupNativeBackButton().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, []);

  return null;
}
