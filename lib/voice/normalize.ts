const BANGLA_DIGITS='০১২৩৪৫৬৭৮৯';
const DIGIT_MAP=new Map([...BANGLA_DIGITS].map((d,i)=>[d,String(i)]));

const WORD_NUMBERS:Record<string,number>={
  শূন্য:0,এক:1,দুই:2,দুইটা:2,তিন:3,চার:4,পাঁচ:5,ছয়:6,ছয়:6,সাত:7,আট:8,নয়:9,নয়:9,
  দশ:10,এগারো:11,বারো:12,তেরো:13,চৌদ্দ:14,পনেরো:15,ষোল:16,সতেরো:17,আঠারো:18,উনিশ:19,বিশ:20,
  ত্রিশ:30,চল্লিশ:40,পঞ্চাশ:50,ষাট:60,সত্তর:70,আশি:80,নব্বই:90,
  একশ:100,একশো:100,দুইশ:200,দুইশো:200,তিনশ:300,তিনশো:300,চারশ:400,চারশো:400,
  পাঁচশ:500,পাঁচশো:500,ছয়শ:600,ছয়শ:600,ছয়শো:600,ছয়শো:600,সাতশ:700,সাতশো:700,
  আটশ:800,আটশো:800,নয়শ:900,নয়শ:900,নয়শো:900,নয়শো:900,
  হাজার:1000,হাজারটা:1000,লাখ:100000,লক্ষ:100000,কোটি:10000000
};

const SMALL_BN:Record<string,number>={
  শূন্য:0,এক:1,দুই:2,তিন:3,চার:4,পাঁচ:5,ছয়:6,ছয়:6,সাত:7,আট:8,নয়:9,নয়:9,
  দশ:10,এগারো:11,বারো:12,তেরো:13,চৌদ্দ:14,পনেরো:15,ষোল:16,সতেরো:17,আঠারো:18,উনিশ:19,
  বিশ:20,ত্রিশ:30,চল্লিশ:40,পঞ্চাশ:50,ষাট:60,সত্তর:70,আশি:80,নব্বই:90
};

export function normalizeBengaliDigits(input:string){
  return [...input].map(c=>DIGIT_MAP.get(c)??c).join('');
}

export function normalizeVoiceText(input:string){
  return normalizeBengaliDigits(input).normalize('NFKC').trim().replace(/\s+/g,' ');
}

/**
 * Understand common Bengali number phrases instead of only Arabic digits.
 * Examples: "পাঁচশ", "দেড় হাজার", "দুই হাজার পাঁচশ", "এক লাখ", "আড়াই হাজার".
 */
function parseBengaliNumberPhrase(input:string):number|null{
  const s=input.toLowerCase().replace(/[।,]/g,' ').replace(/\s+/g,' ').trim();
  if(!s)return null;

  const direct=WORD_NUMBERS[s];
  if(direct!==undefined)return direct;

  const special:{re:RegExp;value:number}[]=[
    {re:/^দেড়\s*(হাজার|লাখ|লক্ষ|কোটি)?$/u,value:1.5},
    {re:/^সাড়ে\s*([০-৯0-9]+|[একদুইতিনচারপাঁচছয়ছয়সাতআটনয়নয়]+)\s*(হাজার|লাখ|লক্ষ|কোটি)$/u,value:0},
    {re:/^আড়াই\s*(হাজার|লাখ|লক্ষ|কোটি)$/u,value:2.5},
  ];
  for(const x of special){
    const m=s.match(x.re);
    if(!m)continue;
    const unit=m[1]||'';
    const mult=unit==='হাজার'?1000:unit==='লাখ'||unit==='লক্ষ'?100000:unit==='কোটি'?10000000:1;
    if(x.value)return x.value*mult;
    const base=Number(m[1]);
    return Number.isFinite(base)?base*mult+base*0.5:null;
  }

  const tokens=s.split(' ');
  let total=0;
  let current=0;
  let found=false;
  for(const token of tokens){
    if(/^\d+(?:\.\d+)?$/u.test(token)){current+=Number(token);found=true;continue;}
    const n=SMALL_BN[token];
    if(n!==undefined){current+=n;found=true;continue;}
    const n2=WORD_NUMBERS[token];
    if(n2!==undefined){
      found=true;
      if(n2>=1000){
        total+=(current||1)*n2;
        current=0;
      }else{
        current+=n2;
      }
    }
  }
  return found?total+current:null;
}

export function extractNumber(input:string):number|null{
  const s=normalizeBengaliDigits(input).replace(/,/g,'');
  const m=s.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  if(m)return Number(m[1]);
  const phrase=parseBengaliNumberPhrase(input);
  return phrase;
}

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
