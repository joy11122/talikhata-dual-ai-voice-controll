'use client';

import {useEffect,useState} from 'react';
import {BriefcaseBusiness,Save,ShieldCheck,Sparkles} from 'lucide-react';

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
  const[form,setForm]=useState({shopName:'',currency:'BDT / ৳',businessType:'GENERAL_RETAIL'});
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);

  useEffect(()=>{
    fetch('/api/shop').then(r=>r.ok?r.json():null).then(x=>{
      if(x)setForm({
        shopName:x.shopName||'',
        currency:x.currency||'BDT / ৳',
        businessType:x.businessType||'GENERAL_RETAIL',
      });
    }).catch(()=>setError('সেটিংস লোড করা যায়নি।'));
  },[]);

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
      setForm({shopName:d.shopName||form.shopName,currency:d.currency||form.currency,businessType:d.businessType||form.businessType});
      setMessage('ব্যবসার তথ্য সফলভাবে সংরক্ষণ হয়েছে।');
      window.dispatchEvent(new Event('talikhata:refresh'));
    }catch{setError('সার্ভারের সাথে যোগাযোগ করা যায়নি।')}
    finally{setBusy(false)}
  }

  return <div className="mx-auto w-full max-w-4xl pb-8 px-4">
    <div className="mb-6 px-1">
      <div className="mb-2 flex items-center gap-2 text-emerald-600"><Sparkles size={17}/><span className="text-xs font-bold uppercase tracking-[0.12em]">Business setup</span></div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">আপনার ব্যবসা সেটআপ করুন</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ব্যবসার ধরন একবার সেট করলে TaliKhata ভবিষ্যতে product, unit, inventory এবং voice command-এর context সেই অনুযায়ী সাজাতে পারবে।</p>
    </div>

    <form onSubmit={save} className="space-y-5">
      <section className="rounded-[28px] border border-white/75 bg-white/70 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><BriefcaseBusiness size={19}/></span>
          <div><h2 className="font-bold text-slate-900">Business profile</h2><p className="mt-1 text-xs text-slate-500">এই তথ্য আপনার ব্যবসার default workflow নির্ধারণের foundation।</p></div>
        </div>

        <div className="form-grid">
          <div>
            <label className="form-label">ব্যবসার নাম</label>
            <input className="field" value={form.shopName} onChange={e=>setForm({...form,shopName:e.target.value})} placeholder="যেমন: রহিম স্টোর" aria-label="ব্যবসার নাম" required/>
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

        {message&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}
        {error&&<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      </section>

      <section className="rounded-[28px] border border-white/75 bg-white/65 p-4 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-xl sm:p-5">
        <div className="flex gap-3">
          <ShieldCheck className="shrink-0 text-emerald-600"/>
          <div><h2 className="font-semibold text-slate-900">Privacy protection</h2><p className="mt-1 text-sm leading-6 text-slate-500">আপনার business data authenticated user-এর scope-এর মধ্যেই থাকে। Voice execution-ও active session যাচাই করে তারপর data পরিবর্তন করে।</p></div>
        </div>
      </section>
    </form>
  </div>
}
