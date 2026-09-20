import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Shop from '@/models/Shop';
import Transaction from '@/models/Transaction';
import AuditLog from '@/models/AuditLog';
import AdminSearch from '@/components/AdminSearch';

export default async function AdminPage(){
  await connectDB();
  const [users,admins,shops,transactions,audits,recentUsers]=await Promise.all([
    User.countDocuments(),User.countDocuments({role:'ADMIN'}),Shop.countDocuments(),Transaction.countDocuments(),AuditLog.countDocuments(),User.find().sort({createdAt:-1}).limit(8).select('name email role status createdAt').lean()
  ]);
  const cards=[['Users',users],['Admins',admins],['Shops',shops],['Transactions',transactions],['Audit logs',audits]];
  return <div><div><p className="text-sm font-semibold text-emerald-700">Administration</p><h1 className="mt-1 text-[30px] font-semibold tracking-[-.035em]">System overview</h1><p className="mt-2 text-slate-500">Manage access and inspect platform activity.</p></div><div className="mt-6"><AdminSearch/></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label,value])=><div key={String(label)} className="rounded-xl border border-black/[.07] bg-white/80 p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-[30px] font-semibold tracking-[-.035em]">{String(value)}</p></div>)}</div><section className="mt-6 rounded-xl border border-black/[.07] bg-white/80 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent users</h2><a href="/admin/users" className="text-sm text-emerald-700">View all</a></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-slate-500"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead><tbody>{recentUsers.map((u:any)=><tr key={String(u._id)} className="border-t border-black/[.07]"><td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3">{u.status}</td><td className="p-3">{new Date(u.createdAt).toLocaleDateString('en-BD')}</td></tr>)}</tbody></table></div></section></div>;
}
