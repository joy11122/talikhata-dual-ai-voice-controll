
import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ToastProvider';
import NativeShell from '@/components/NativeShell';
import Providers from '@/components/Providers';
import './globals.css';

const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://talikhata.app'
).replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'TaliKhata Voice | বাংলা দোকানের হিসাব ও বাকির খাতা',
    template: '%s | TaliKhata Voice',
  },

  description:
    'বাংলা, Banglish ও English voice দিয়ে বাকির খাতা, বিক্রি, ক্রয়, স্টক, পেমেন্ট ও দোকানের দৈনিক হিসাব পরিচালনা করুন।',

  applicationName: 'TaliKhata Voice',

  keywords: [
    'TaliKhata',
    'তালিখাতা',
    'বাকির খাতা',
    'দোকানের হিসাব',
    'Bangla accounting',
    'Banglish accounting',
    'inventory management Bangladesh',
    'small business accounting Bangladesh',
  ],

  authors: [{ name: 'TaliKhata Voice' }],
  creator: 'TaliKhata Voice',
  publisher: 'TaliKhata Voice',

  alternates: {
    canonical: '/',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'TaliKhata Voice',
    title: 'TaliKhata Voice | বাংলা দোকানের হিসাব',
    description:
      'Voice দিয়ে বাকির খাতা, স্টক, বিক্রি ও দৈনিক দোকানের হিসাব পরিচালনা করুন।',
    locale: 'bn_BD',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'TaliKhata Voice',
    description:
      'বাংলা voice-first দোকান হিসাব ও inventory management.',
  },

  category: 'business',

  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      {
        url: '/icon-192.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaliKhata Voice',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android',
    description:
      'বাংলা, Banglish ও English voice-controlled ledger, inventory and shop accounting application.',
    url: siteUrl,
    inLanguage: ['bn-BD', 'en'],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BDT',
    },
  };

  return (
    <html lang="bn-BD">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />

        <Providers>
          <ToastProvider>
            <NativeShell />
            {children}
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
