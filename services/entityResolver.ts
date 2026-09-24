import Party from '@/models/Party';import Product from '@/models/Product';import {Types,ClientSession} from 'mongoose';import {normalizeVoiceText,phoneticKey,transliterateBanglish} from '@/lib/voice/normalize';
function consonantKey(name:string){
  return phoneticKey(name).replace(/[aeiou]/g,'');
}
function escapeRegex(s:string){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function variants(name:string){
  const raw=normalizeVoiceText(name).toLowerCase().trim();
  const base=raw
    .replace(/(?:এর|র|কে|দের|ে)$/u,'')
    .replace(/\s+(?:er|r|ke|der|e)$/i,'')
    .trim();
  const bangla=transliterateBanglish(base);
  const banglish=transliterateBanglish(raw);
  const stems=[raw,base,banglish,bangla];
  return [...new Set([
    ...stems,
    ...stems.map(v=>v.replace(/(?:এর|র|কে|দের|ে)$/u,'').replace(/\s+(?:er|r|ke|der|e)$/i,'').trim())
  ])].filter(Boolean);
}
export async function resolveParty(userId:string,name:string,session?:ClientSession){const uid=new Types.ObjectId(userId);const vs=variants(name);const exact=await Party.find({userId:uid,name:{$in:vs.map(v=>new RegExp(`^${escapeRegex(v)}$`,'i'))}}).session(session??null).limit(20);if(exact.length)return exact;try{const text=await Party.find({userId:uid,$text:{$search:name}}).sort({score:{$meta:'textScore'}}).session(session??null).limit(20);if(text.length)return text;}catch{}const fallback=await Party.find({userId:uid,$or:vs.flatMap(v=>[{name:new RegExp(escapeRegex(v),'i')},{phone:new RegExp(escapeRegex(v),'i')}])}).session(session??null).limit(20);if(fallback.length)return fallback;const candidates=await Party.find({userId:uid}).select('_id name phone partyType currentBalance').session(session??null).limit(150);const keys=new Set(vs.flatMap(v=>[phoneticKey(v),consonantKey(v)]));return candidates.filter(x=>{const xkeys=[phoneticKey(x.name),consonantKey(x.name)];return xkeys.some(k=>keys.has(k));}).slice(0,20);}
export async function resolveProduct(userId:string,name:string,session?:ClientSession){const uid=new Types.ObjectId(userId);const vs=variants(name);const exact=await Product.find({userId:uid,name:{$in:vs.map(v=>new RegExp(`^${escapeRegex(v)}$`,'i'))}}).session(session??null).limit(20);if(exact.length)return exact;try{const text=await Product.find({userId:uid,$text:{$search:name}}).sort({score:{$meta:'textScore'}}).session(session??null).limit(20);if(text.length)return text;}catch{}const fallback=await Product.find({userId:uid,$or:vs.map(v=>({name:new RegExp(escapeRegex(v),'i')}))}).session(session??null).limit(20);if(fallback.length)return fallback;const candidates=await Product.find({userId:uid}).select('_id name unit stockQuantity buyPrice sellPrice').session(session??null).limit(150);const key=phoneticKey(name);const ckey=consonantKey(name);return candidates.filter(x=>phoneticKey(x.name)===key||consonantKey(x.name)===ckey).slice(0,20);}
