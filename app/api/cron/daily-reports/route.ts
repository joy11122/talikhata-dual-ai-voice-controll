import {NextResponse} from 'next/server';
import {connectDB} from '@/lib/db';
import DailyReportSetting from '@/models/DailyReportSetting';
import Notification from '@/models/Notification';
import User from '@/models/User';
import Shop from '@/models/Shop';
import Transaction from '@/models/Transaction';
import Product from '@/models/Product';
import nodemailer from 'nodemailer';
import {Types} from 'mongoose';

function dateParts(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';
  return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour').padStart(2,'0')}:${get('minute').padStart(2,'0')}`};
}

function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c));}

export async function GET(req:Request){
  const expected=process.env.DAILY_REPORT_CRON_SECRET;
  if(!expected||req.headers.get('authorization')!==`Bearer ${expected}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const now=new Date();
  const settings=await DailyReportSetting.find({enabled:true}).lean();
  let processed=0,sent=0,failed=0;
  for(const setting of settings){
    const local=dateParts(now,setting.timezone||'Asia/Dhaka');
    const configuredHour=Number((setting.sendTime||'00:00').split(':')[0]);
    const currentHour=Number(local.time.split(':')[0]);
    if(currentHour!==configuredHour||setting.lastSentDate===local.date)continue;
    const uid=new Types.ObjectId(setting.userId);
    try{
      const start=new Date(`${local.date}T00:00:00`);
      const end=new Date(start.getTime()+86_400_000);
      const [user,shop,tx,products]=await Promise.all([
        User.findById(uid).select('email name').lean(),
        Shop.findOne({userId:uid}).lean(),
        Transaction.find({userId:uid,type:'SALE',isDeleted:false,timestamp:{$gte:start,$lt:end}}).sort({timestamp:1}).lean(),
        Product.find({userId:uid}).select('_id name').lean(),
      ]);
      const map=new Map(products.map(p=>[String(p._id),p.name]));
      const total=tx.reduce((sum,x)=>sum+(x.amount||0),0);
      const items=tx.map(x=>`${map.get(String(x.productId))||'Sale'} × ${x.quantity||1}: ৳${(x.amount||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
      const message=`${shop?.shopName||'TaliKhata'} — Daily Sales Report\nDate: ${local.date}\nSales: ${tx.length}\nTotal: ৳${total.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}${items.length?'\n\n'+items.slice(0,30).join('\n'):''}`;
      if(setting.inAppEnabled)await Notification.create({userId:uid,type:'DAILY_SALES_REPORT',title:'আজকের Sales Report',message,metadata:{date:local.date,total,count:tx.length}});
      if(setting.emailEnabled&&user?.email&&process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS){
        const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
        await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:user.email,subject:`${shop?.shopName||'TaliKhata'} — Daily Sales Report — ${local.date}`,html:`<h2>Daily Sales Report</h2><p><b>Date:</b> ${esc(local.date)}</p><p><b>Total Sales:</b> ${tx.length}</p><p><b>Total:</b> ৳${total.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}</p><hr/><ul>${items.slice(0,30).map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`});
      }
      await DailyReportSetting.updateOne({_id:setting._id},{$set:{lastSentDate:local.date}});
      sent++;processed++;
    }catch{failed++;processed++;}
  }
  return NextResponse.json({ok:true,processed,sent,failed});
}