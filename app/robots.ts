import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talikhata.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] }],
    sitemap: `${baseUrl.replace(/\/$/, '')}/sitemap.xml`,
    host: baseUrl,
  };
}
