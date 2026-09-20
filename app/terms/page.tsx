import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | TaliKhata Voice',
  description: 'Terms of Service for TaliKhata Voice.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <main className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
    <h1>Terms of Service</h1>
    <p>Last updated: September 15, 2026</p>
    <p>TaliKhata Voice is a business record-keeping tool. You are responsible for reviewing entries, balances, stock quantities and reports before relying on them for business decisions.</p>
    <h2>Account responsibility</h2>
    <p>Keep your credentials secure and use only information you are authorized to manage.</p>
    <h2>Financial records</h2>
    <p>Voice interpretation is an assistive interface. Review confirmations for important or high-value transactions.</p>
    <h2>Service availability</h2>
    <p>Cloud availability, third-party authentication and AI services may occasionally be unavailable.</p>
  </main>;
}
