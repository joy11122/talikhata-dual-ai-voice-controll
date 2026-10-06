import Party from '@/models/Party';import Product from '@/models/Product';import {Types,ClientSession} from 'mongoose';import {normalizeVoiceText,phoneticKey,transliterateBanglish} from '@/lib/voice/normalize';
function consonantKey(name:string){
  return phoneticKey(name).replace(/[aeiou]/g,'');
}

/**
 * Compare Bengali names with common Banglish spellings.
 *
 * Example:
 *   রহিম -> rhim
 *   Rahim -> rhim
 *
 * Bengali speech/text frequently arrives in Banglish with an explicit
 * "a" that is implicit in Bengali orthography. Removing that short
 * inter-consonant "a" makes these representations resolve to the same
 * identity without changing the stored party name.
 */
function banglishComparable(name:string){
  const raw=normalizeVoiceText(name).toLowerCase().trim();
  if(!/[a-z]/i.test(raw)) return phoneticKey(raw);

  const s=raw
    .replace(/[^a-z0-9\s]/gi,' ')
    .replace(/\s+/g,' ')
    .trim();

  // Common Banglish suffixes used by voice/STT.
  const stem=s.replace(/\s+(?:er|r|ke|k|der|e)$/i,'').trim();

  // Normalize common alternate spellings first.
  const normalized=stem
    .replace(/ph/g,'f')
    .replace(/bh/g,'b')
    .replace(/kh/g,'k')
    .replace(/gh/g,'g')
    .replace(/dh/g,'d')
    .replace(/th/g,'t')
    .replace(/sh/g,'s')
    .replace(/chh/g,'c')
    .replace(/ch/g,'c')
    .replace(/aa/g,'a')
    .replace(/ee/g,'i')
    .replace(/ii/g,'i')
    .replace(/oo/g,'u')
    .replace(/uu/g,'u')
    .replace(/ou/g,'o')
    .replace(/ow/g,'o')
    .replace(/w/g,'b')
    .replace(/v/g,'b')
    .replace(/z/g,'j')
    .replace(/q/g,'k')
    .replace(/x/g,'ks');

  // Bengali orthography normally does not spell the inherent "a".
  // "Rahim", "Karim", "Jasim" therefore compare as "rhim", "krim", "jsim".
  return normalized
    .replace(/([bcdfghjklmnpqrstvwxyz])a(?=[bcdfghjklmnpqrstvwxyz])/g,'$1')
    .replace(/(.)\1+/g,'$1');
}

function identityKeys(name:string){
  const raw=normalizeVoiceText(name).toLowerCase().trim();
  return new Set([
    phoneticKey(raw),
    consonantKey(raw),
    banglishComparable(raw),
    banglishComparable(transliterateBanglish(raw)),
  ].filter(Boolean));
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
export async function resolveParty(userId:string,name:string,session?:ClientSession){const uid=new Types.ObjectId(userId);const vs=variants(name);const exact=await Party.find({userId:uid,name:{$in:vs.map(v=>new RegExp(`^${escapeRegex(v)}$`,'i'))}}).session(session??null).limit(20);if(exact.length)return exact;try{const text=await Party.find({userId:uid,$text:{$search:name}}).sort({score:{$meta:'textScore'}}).session(session??null).limit(20);if(text.length)return text;}catch{}const fallback=await Party.find({userId:uid,$or:vs.flatMap(v=>[{name:new RegExp(escapeRegex(v),'i')},{phone:new RegExp(escapeRegex(v),'i')}])}).session(session??null).limit(20);if(fallback.length)return fallback;const candidates=await Party.find({userId:uid}).select('_id name phone partyType currentBalance').session(session??null).limit(300);
  const keys=new Set(vs.flatMap(v=>Array.from(identityKeys(v))));
  return candidates.filter(x=>{
    const xkeys=Array.from(identityKeys(x.name));
    return xkeys.some(k=>keys.has(k));
  }).slice(0,20);}
export async function resolveProduct(userId:string,name:string,session?:ClientSession){const uid=new Types.ObjectId(userId);const query={userId:uid,isDeleted:{$ne:true}};const raw=normalizeVoiceText(name).normalize('NFKC').replace(/[।,!?;:]/g,' ').replace(/\\s+/g,' ').trim();const vs=variants(raw);const exact=await Product.find({...query,name:{$in:vs.map(v=>new RegExp(`^${escapeRegex(v.normalize('NFKC'))}$`,'iu'))}}).session(session??null).limit(20);if(exact.length)return exact;try{const text=await Product.find({...query,$text:{$search:raw}}).sort({score:{$meta:'textScore'}}).session(session??null).limit(20);if(text.length)return text;}catch{}const fallback=await Product.find({...query,$or:vs.map(v=>({name:new RegExp(escapeRegex(v),'iu')}))}).session(session??null).limit(20);if(fallback.length)return fallback;const keys=new Set(vs.flatMap(v=>Array.from(identityKeys(v))));const candidates=await Product.find(query).select('_id name unit stockQuantity buyPrice sellPrice').session(session??null).limit(300);
  // Final deterministic pass: compare the canonical Unicode form of the spoken
  // name with stored product names. This handles invisible whitespace/NFKC
  // differences that can defeat regex/text indexes while preserving user isolation.
  const canonical = (value:string) => normalizeVoiceText(value).normalize('NFKC').replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const canonicalName = canonical(raw);
  const canonicalMatches = candidates.filter(x => canonical(x.name) === canonicalName);
  if (canonicalMatches.length) return canonicalMatches.slice(0, 20);
  return candidates.filter(x=>Array.from(identityKeys(x.name)).some(k=>keys.has(k))).slice(0,20);}\n