'use client';

import {useEffect,useState} from 'react';
import {BriefcaseBusiness,Save,ShieldCheck,Sparkles,Clock,Mail, Bell} from 'lucide-react';

const businessTypes=[
  ['GENERAL_RETAIL','সাধারণ দোকান','General shop / mixed products'],
  ['GROCERY','মুদি / গ্রোসারি','Grocery, food and daily essentials'],
  ['CLOTHING','কাপড় / ফ্যাশন','Clothing, shoes and fashion'],
  ['ELECTRONICS','ইলেকট্রনিক্স','Phones, gadgets and electronics'],
  ['PHARMACY','ফার্মেসি','Medicine and healthcare retail'],
  ['RESTAURANT','রেস্টুরেন্ট / খাবার','Restaurant, cafe and food sales'],
  ['WHOLESALE','পাইকারি ব্যবসা','Wholesale and distribution'],
  ['SERVICE','সার্ভিস ব্যবসা','Repair, labour and other services'],
  ['HARDWARE','হার্ডওয়্যার','Hardware, tools and building supplies'],
  ['OTHER','অন্যান্য','Other business type'],
] as const;

export default function SettingsPage(){
  const[form,setForm]=useState({shopName:'',currency:'BDT / ৳',businessType:'GENERAL_RETAIL',address:''});
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[report,setReport]=useState({enabled:false,sendTime:'21:00',timezone:'Asia/Dhaka',emailEnabled:true,inAppEnabled:true,email:''});
  const[reportMessage,setReportMessage]=useState('');
  const[reportBusy,setReportBusy]=useState(false);

  useEffect(()=>{
    fetch('/api/shop').then(r=>r.ok?r.json():null).then(x=>{
      if(x)setForm({
        shopName:x.shopName||'',
        currency:x.currency||'BDT / ৳',
        businessType:x.businessType||'GENERAL_RETAIL',
        address:x.address||'',
      });
    }).catch(()=>setError('সেটিংস লোড করা যায়নি।'));
  },[]);

  useEffect(()=>{
    fetch('/api/daily-report/settings').then(r=>r.ok?r.json():null).then(x=>{if(x)setReport(x)}).catch(()=>{});
  },[]);

  async function saveReport(e:React.FormEvent){
    e.preventDefault();setReportBusy(true);setReportMessage('');
    try{
      const r=await fetch('/api/daily-report/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(report)});
      const d=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(d?.error||'রিপোর্ট সেটিংস সংরক্ষণ করা যায়নি');
      setReport(d);setReportMessage('Daily sales report settings saved.');
    }catch(e){setReportMessage(e instanceof Error?e.message:'সেটিংস সংরক্ষণ করা যায়নি।')}
    finally{setReportBusy(false)}
  }

  async function save(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);setMessage('');setError('');
    try{
      const r=await fetch('/api/shop',{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(form),
      });
      const d=await r.json().catch(()=>null);
      if(!r.ok){setError(typeof d?.error==='string'?d.error:'সেটিংস সংরক্ষণ করা যায়নি।');return}
      setForm({shopName:d.shopName||form.shopName,currency:d.currency||form.currency,businessType:d.businessType||form.businessType,address:d.address||form.address});
      setMessage('ব্যবসার তথ্য সফলভাবে সংরক্ষণ হয়েছে।');
      window.dispatchEvent(new Event('talikhata:refresh'));
    }catch{setError('সার্ভারের সাথে যোগাযোগ করা যায়নি।')}
    finally{setBusy(false)}
  }

  return <div className="mx-auto w-full max-w-4xl pb-8 px-4 md:px-0">
    <div className="mb-6 px-1">
      <div className="mb-2 flex items-center gap-2 text-emerald-600"><Sparkles size={17}/><span className="text-xs font-bold uppercase tracking-[0.12em]">Business setup</span></div>
      <h1 className="text-3xl font-bold tracking-tight text-white">আপনার ব্যবসা সেটআপ করুন</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">ব্যবসার ধরন একবার সেট করলে TaliKhata ভবিষ্যতে product, unit, inventory এবং voice command-এর context সেই অনুযায়ী সাজাতে পারবে।</p>
    </div>

    <form onSubmit={save} className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-transparent p-4 shadow-[0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><BriefcaseBusiness size={19}/></span>
          <div><h2 className="font-bold text-white">Business profile</h2><p className="mt-1 text-xs text-white/50">এই তথ্য আপনার ব্যবসার default workflow নির্ধারণের foundation।</p></div>
        </div>

        <div className="form-grid">
          <div>
            <label className="form-label">ব্যবসার নাম</label>
            <input className="field" value={form.shopName} onChange={e=>setForm({...form,shopName:e.target.value})} placeholder="যেমন: রহিম স্টোর" aria-label="ব্যবসার নাম" required/>
          </div>

          <div>
            <label className="form-label">ঠিকানা</label>
            <input className="field" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="যেমন: ১২৩ মার্কেট রোড, খুলনা" aria-label="ঠিকানা" maxLength={240}/>
          </div>

          <div>
            <label className="form-label">ব্যবসার ধরন</label>
            <select className="field" value={form.businessType} onChange={e=>setForm({...form,businessType:e.target.value})} aria-label="ব্যবসার ধরন">
              {businessTypes.map(([value,label,description])=><option key={value} value={value}>{label} — {description}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Currency</label>
            <input className="field" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} placeholder="BDT / ৳" aria-label="Currency" required/>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button disabled={busy} aria-busy={busy} className="btn-primary w-full sm:w-auto">{busy?<span className="spinner"/>:<Save size={17}/>} {busy?'সংরক্ষণ হচ্ছে…':'সংরক্ষণ করুন'}</button>
        </div>

        {message&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">{message}</div>}
        {error&&<div className="mt-4 rounded-2xl border border-red-200 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">{error}</div>}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-transparent p-4 shadow-[0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Bell size={19}/></span>
          <div><h2 className="font-bold text-white">Daily sales report</h2><p className="mt-1 text-xs leading-5 text-white/50">দোকান বন্ধ হওয়ার সময় অনুযায়ী প্রতিদিনের sales summary automatically পাঠান।</p></div>
        </div>
        <form onSubmit={saveReport} className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-transparent px-4 py-3">
            <div><div className="font-semibold text-white">Automatic report</div><div className="text-xs text-white/50">প্রতিদিন একবার পাঠানো হবে</div></div>
            <button type="button" role="switch" aria-checked={report.enabled} onClick={()=>setReport({...report,enabled:!report.enabled})} className={`relative h-7 w-12 rounded-full transition ${report.enabled?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-transparent shadow transition ${report.enabled?'left-6':'left-1'}`}/></button>
          </div>
          <div className="form-grid">
            <div><label className="form-label flex items-center gap-2"><Clock size={15}/>Report time</label><input className="field" type="time" value={report.sendTime} onChange={e=>setReport({...report,sendTime:e.target.value})}/><p className="mt-1 text-xs text-white/50">আপনার দোকান বন্ধ হওয়ার সময় দিন।</p></div>
            <div><label className="form-label">Timezone</label><select className="field" value={report.timezone} onChange={e=>setReport({...report,timezone:e.target.value})}><option value="Asia/Dhaka">Bangladesh — Asia/Dhaka</option><option value="Asia/Kolkata">India — Asia/Kolkata</option><option value="Asia/Dubai">UAE — Asia/Dubai</option><option value="Europe/London">UK — Europe/London</option><option value="America/New_York">US Eastern — America/New_York</option></select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-transparent p-4"><input type="checkbox" checked={report.inAppEnabled} onChange={e=>setReport({...report,inAppEnabled:e.target.checked})}/><Bell size={17}/><span><b className="block text-sm">In-app notification</b><small className="text-xs text-white/50">Free</small></span></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-transparent p-4"><input type="checkbox" checked={report.emailEnabled} onChange={e=>setReport({...report,emailEnabled:e.target.checked})}/><Mail size={17}/><span><b className="block text-sm">Email</b><small className="text-xs text-white/50">{report.email||'Your account email'}</small></span></label>
          </div>
          <button disabled={reportBusy} className="btn-primary w-full sm:w-auto">{reportBusy?'Saving…':'Save report settings'}</button>
          {reportMessage&&<div className="rounded-2xl border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{reportMessage}</div>}
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-transparent p-4 shadow-[0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-5">
        <div className="flex gap-3">
          <ShieldCheck className="shrink-0 text-emerald-600"/>
          <div><h2 className="font-semibold text-white">Privacy protection</h2><p className="mt-1 text-sm leading-6 text-white/50">আপনার business data authenticated user-এর scope-এর মধ্যেই থাকে। Voice execution-ও active session যাচাই করে তারপর data পরিবর্তন করে।</p></div>
        </div>
      </section>
    </form>
  </div>
}
