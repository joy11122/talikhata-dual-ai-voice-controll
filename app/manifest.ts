
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaliKhata Voice — বাংলা দোকান হিসাব',
    short_name: 'TaliKhata',
    description:
      'বাংলা, Banglish ও English voice দিয়ে বাকির খাতা, বিক্রি, স্টক ও দোকানের হিসাব পরিচালনা করুন।',

    start_url: '/dashboard',
    display: 'standalone',

    background_color: '#f8fafc',
    theme_color: '#059669',

    lang: 'bn',
    dir: 'ltr',

    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
