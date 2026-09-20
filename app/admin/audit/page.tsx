import {connectDB} from '@/lib/db';
import AuditLog from '@/models/AuditLog';
import AdminAuditLog from '@/models/AdminAuditLog';
export default async function AdminAudit(){
 await connectDB();
 const [logs,adminLogs]=await Promise.all([
  AuditLog.find().sort({createdAt:-1}).limit(100).populate('userId','name email').lean(),
  AdminAuditLog.find().sort({createdAt:-1}).limit(50).populate('adminId','name email').lean()
 ]);
 return <div><h1 className="text-[30px] font-semibold tracking-[-.035em]">Audit logs</h1><p className="mt-2 text-slate-500">Voice execution records and administrator actions across the platform.</p>
 <section className="mt-6 overflow-x-auto rounded-xl border border-black/[.07] bg-white/80"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-slate-500"><tr><th className="p-4">Time</th><th className="p-4">User</th><th className="p-4">Status</th><th className="p-4">Transcript</th></tr></thead><tbody>{logs.map((l:any)=><tr key={String(l._id)} className="border-t border-black/[.07]"><td className="p-4">{new Date(l.createdAt).toLocaleString('en-BD')}</td><td className="p-4">{l.userId?.email||'Unknown'}</td><td className="p-4">{l.status}</td><td className="max-w-md p-4 text-slate-600">{l.voiceTranscript}</td></tr>)}</tbody></table></section>
 <section className="mt-6 overflow-x-auto rounded-xl border border-black/[.07] bg-white/80"><div className="p-5"><h2 className="font-semibold">Admin actions</h2><p className="mt-1 text-sm text-slate-500">Changes performed by administrators.</p></div><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-500"><tr><th className="p-4">Time</th><th className="p-4">Admin</th><th className="p-4">Action</th><th className="p-4">Target</th></tr></thead><tbody>{adminLogs.map((l:any)=><tr key={String(l._id)} className="border-t border-black/[.07]"><td className="p-4">{new Date(l.createdAt).toLocaleString('en-BD')}</td><td className="p-4">{l.adminId?.email||'Unknown'}</td><td className="p-4">{l.action}</td><td className="p-4">{l.targetType||'—'}</td></tr>)}</tbody></table></section></div>
}
