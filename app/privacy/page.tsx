import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | TaliKhata Voice',
  description: 'TaliKhata Voice privacy policy and information about account, shop, voice and financial data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <main className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
    <h1>Privacy Policy</h1>
    <p>Last updated: September 15, 2026</p>
    <p>TaliKhata Voice helps small businesses manage customers, suppliers, inventory, sales, expenses and voice commands.</p>
    <h2>Information we process</h2>
    <p>Depending on the features you use, the service may process account information, shop records, customer and supplier records, inventory, transactions, audit records and voice transcripts.</p>
    <h2>Voice data</h2>
    <p>Voice input is used to transcribe and interpret commands. Do not use the voice feature to submit passwords, payment-card numbers, NID numbers or other unnecessary sensitive information.</p>
    <h2>Security</h2>
    <p>Tenant-scoped authorization, validation, audit logging and encrypted HTTPS transport are used as part of the application security design.</p>
    <h2>Contact</h2>
    <p>Replace this section with your official support email before publishing.</p>
  </main>;
}
