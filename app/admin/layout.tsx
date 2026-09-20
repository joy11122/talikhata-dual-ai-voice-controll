import Link from 'next/link';
import {auth} from '@/auth';
import {redirect} from 'next/navigation';
import {ShieldCheck,LayoutDashboard,Users,ScrollText,Store,ShieldAlert,Activity} from 'lucide-react';

export default async function AdminLayout({children}:{children:React.ReactNode}){
  const session=await auth();
  if(!session?.user?.id) redirect('/signin?callbackUrl=/admin');
  if(session.user.role!=='ADMIN') redirect('/dashboard');
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-30 border-b border-black/[.07] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 text-[18px] font-semibold tracking-[-.025em]">
            <ShieldCheck size={19} className="text-emerald-600"/> TaliKhata Admin
          </Link>
          <Link href="/dashboard" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-black/[.05]">Back to app</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-black/[.07] bg-white/80 p-2 shadow-[0_4px_18px_rgba(0,0,0,.04)] backdrop-blur-xl">
          <nav className="grid gap-0.5">
            <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin"><LayoutDashboard size={18}/> Overview</Link>
            <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin/users"><Users size={18}/> Users</Link>
            <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin/audit"><ScrollText size={18}/> Audit logs</Link><Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin/shops"><Store size={18}/> Shops</Link><Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin/security"><ShieldAlert size={18}/> Security</Link><Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/[.05]" href="/admin/health"><Activity size={18}/> System health</Link>
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
