const BANGLA_DIGITS='০১২৩৪৫৬৭৮৯';
const DIGIT_MAP=new Map([...BANGLA_DIGITS].map((d,i)=>[d,String(i)]));
const WORD_NUMBERS:Record<string,number>={শূন্য:0,এক:1,দুই:2,তিন:3,চার:4,পাঁচ:5,ছয়:6,ছয়:6,সাত:7,আট:8,নয়:9,নয়:9,দশ:10,এগারো:11,বারো:12,তেরো:13,চৌদ্দ:14,পনেরো:15,ষোল:16,সতেরো:17,আঠারো:18,উনিশ:19,বিশ:20,ত্রিশ:30,চল্লিশ:40,পঞ্চাশ:50,ষাট:60,সত্তর:70,আশি:80,নব্বই:90,একশ:100,একশো:100,দুইশ:200,দুইশো:200,পাঁচশ:500,পাঁচশো:500,হাজার:1000};
export function normalizeBengaliDigits(input:string){return [...input].map(c=>DIGIT_MAP.get(c)??c).join('');}
export function normalizeVoiceText(input:string){return normalizeBengaliDigits(input).normalize('NFKC').trim().replace(/\s+/g,' ');}
export function extractNumber(input:string):number|null{const s=normalizeBengaliDigits(input).replace(/,/g,'');const m=s.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);if(m)return Number(m[1]);for(const [word,value] of Object.entries(WORD_NUMBERS))if(new RegExp(`(^|\\s)${word}(?=\\s|$)`).test(input))return value;return null;}


const PHONETIC_MAP:Record<string,string>={c:'k',q:'k',x:'ks',z:'j',v:'b',w:'b',f:'ph'};
const BANGLISH_TO_BENGALI: Array<[string,string]> = [
  ['chh','ছ'],['kh','খ'],['gh','ঘ'],['ph','ফ'],['bh','ভ'],['th','থ'],['dh','ধ'],
  ['sh','শ'],['ss','স'],['ng','ং'],['ny','ঞ'],['jn','জ'],
  ['aa','আ'],['ee','ঈ'],['ii','ঈ'],['oo','ঊ'],['uu','ঊ'],
  ['a','অ'],['b','ব'],['c','ক'],['d','দ'],['e','এ'],['f','ফ'],['g','গ'],
  ['h','হ'],['i','ই'],['j','জ'],['k','ক'],['l','ল'],['m','ম'],['n','ন'],
  ['o','ও'],['p','প'],['q','ক'],['r','র'],['s','স'],['t','ত'],['u','উ'],
  ['v','ভ'],['w','ও'],['x','ক্স'],['y','য়'],['z','জ'],
];

function stripNameAffixes(input:string): string {
  return normalizeVoiceText(input).toLowerCase()
    .replace(/\s+(?:er|r|ke|k|der)$/i,'')
    .replace(/(?:এর|র|কে|দের|ে)$/u,'')
    .trim();
}

export function transliterateBanglish(input:string): string {
  let s = stripNameAffixes(input);
  if (!/[a-z]/i.test(s)) return s;
  for (const [from,to] of BANGLISH_TO_BENGALI) s = s.split(from).join(to);
  return s;
}

export function phoneticKey(input:string){
  const base = stripNameAffixes(input);
  const banglish = /[a-z]/i.test(base) ? transliterateBanglish(base) : base;
  return normalizeVoiceText(banglish).toLowerCase()
    .replace(/[আঅা]/g,'a').replace(/[ইঈিী]/g,'i').replace(/[উঊুূ]/g,'u')
    .replace(/[এে]/g,'e').replace(/[ওো]/g,'o').replace(/[য়য]/g,'y')
    .replace(/[শষস]/g,'s').replace(/[জঝ]/g,'j').replace(/[চছ]/g,'c')
    .replace(/[টঠ]/g,'t').replace(/[ডঢ]/g,'d').replace(/[তথ]/g,'t')
    .replace(/[দধ]/g,'d').replace(/[পফ]/g,'p').replace(/[বভ]/g,'b')
    .replace(/[কখ]/g,'k').replace(/[গঘ]/g,'g').replace(/[রড়ঢ়]/g,'r')
    .replace(/[ল]/g,'l').replace(/[ম]/g,'m').replace(/[নণ]/g,'n')
    .replace(/[ংঁ]/g,'n').replace(/[হ]/g,'h').replace(/[্]/g,'')
    .replace(/[^a-z0-9ঀ-৿]/g,'')
    .replace(/[cq]/g,'k').replace(/x/g,'ks').replace(/z/g,'j')
    .replace(/v/g,'b').replace(/w/g,'b').replace(/(.)\1+/g,'$1');
}
