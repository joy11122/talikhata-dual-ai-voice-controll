export type AssistantIntent='SALES'|'PURCHASE'|'EXPENSE'|'INCOME'|'PROFIT'|'BALANCE'|'STOCK'|'CUSTOMERS'|'SUPPLIERS'|'TRANSACTIONS'|'TOP_SALES'|'SUMMARY'|'UNKNOWN';
export type AssistantRange={start:Date;end:Date;label:string};
export const normalizeBangla=(s:string)=>s.replace(/[০-৯]/g,d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d))).toLocaleLowerCase('bn-BD').replace(/[?؟!।,،]/g,' ').replace(/\s+/g,' ').trim();
export const money=(n:number)=>'৳'+Math.round(n||0).toLocaleString('en-BD');
export function getAssistantRange(q:string,now=new Date()):AssistantRange{
 const x=normalizeBangla(q),today=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00+06:00');
 const n=x.match(/(?:গত|last|শেষ)\s*(\d+)\s*(?:দিন|day|days)/i),m=x.match(/(?:গত|last|শেষ)\s*(\d+)\s*(?:মিনিট|minute|minutes|min)/i);
 if(n){const d=Number(n[1]);return{start:new Date(now.getTime()-d*86400000),end:now,label:'গত '+d+' দিন'};}
 if(m){const v=Number(m[1]);return{start:new Date(now.getTime()-v*60000),end:now,label:'গত '+v+' মিনিট'};}
 if(/আজ|today|ajke|ajker/.test(x))return{start:today,end:now,label:'আজ'};
 if(/গতকাল|yesterday|gotoshkal/.test(x))return{start:new Date(today.getTime()-86400000),end:today,label:'গতকাল'};
 if(/এই মাস|this month|ei mash/.test(x)){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit'}).formatToParts(now);return{start:new Date(p.find(z=>z.type==='year')!.value+'-'+p.find(z=>z.type==='month')!.value+'-01T00:00:00+06:00'),end:now,label:'এই মাস'};}
 if(/এই বছর|this year|ei bochor/.test(x)){const y=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric'}).format(now);return{start:new Date(y+'-01-01T00:00:00+06:00'),end:now,label:'এই বছর'};}
 if(/গত বছর|last year|goto bochor/.test(x)){const y=Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric'}).format(now));return{start:new Date((y-1)+'-01-01T00:00:00+06:00'),end:new Date(y+'-01-01T00:00:00+06:00'),label:'গত বছর'};}
 if(/এই সপ্তাহ|this week|ei soptaho/.test(x))return{start:new Date(today.getTime()-6*86400000),end:now,label:'এই সপ্তাহ'};
 if(/গত সপ্তাহ|last week|goto soptaho/.test(x))return{start:new Date(today.getTime()-13*86400000),end:new Date(today.getTime()-6*86400000),label:'গত সপ্তাহ'};
 return{start:new Date(0),end:now,label:'সকল সময়'};
}
export function detectAssistantIntent(q:string):AssistantIntent{
 const x=normalizeBangla(q);
 if(/ব্যবসা.*(সারাংশ|অবস্থা|কেমন)|business.*(summary|overview|performance)/.test(x))return'SUMMARY';
 if(/সবচেয়ে বেশি|সবচেয়ে বেশি|most|highest|top/.test(x)&&/বিক্রি|sales|sell/.test(x))return'TOP_SALES';
 if(/লাভ|profit/.test(x))return'PROFIT';
 if(/খরচ|expense|ব্যয়|ব্যয়/.test(x))return'EXPENSE';
 if(/আয়|আয়|income|commission|কমিশন/.test(x))return'INCOME';
 if(/purchase|buy|bought|কেনা|কিনেছি|কিনলাম|ক্রয়|ক্রয়/.test(x))return'PURCHASE';
 if(/বিক্রি|বেচা|sales?|sell|sold/.test(x))return'SALES';
 if(/বাকি|balance|পাওনা|দেনা|receivable|payable|owe|owes|দিতে হবে|পাবো/.test(x))return'BALANCE';
 if(/stock|স্টক|inventory|মজুদ|কত আছে/.test(x))return'STOCK';
 if(/customer|কাস্টমার|গ্রাহক/.test(x)&&/সব|all|list|দেখাও|দেখান|কারা/.test(x))return'CUSTOMERS';
 if(/supplier|সাপ্লায়ার|সাপ্লায়ার|সরবরাহকারী/.test(x)&&/সব|all|list|দেখাও|দেখান|কারা/.test(x))return'SUPPLIERS';
 if(/লেনদেন|transaction|recent|শেষ.*(লেনদেন|transaction)/.test(x))return'TRANSACTIONS';
 return'UNKNOWN';
}