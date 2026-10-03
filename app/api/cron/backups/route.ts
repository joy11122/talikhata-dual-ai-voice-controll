import {NextResponse} from 'next/server';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
import Party from '@/models/Party';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Backup from '@/models/Backup';
import Notification from '@/models/Notification';

function clean(value:any){return JSON.parse(JSON.stringify(value));}

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET||process.env.BACKUP_CRON_SECRET;
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  await connectDB();
  const users=await User.find({}).select('_id').lean();let created=0;
  for(const user of users){
    const uid=user._id;
    try{
      const [parties,products,transactions]=await Promise.all([
        Party.find({userId:uid,isDeleted:false}).lean(),
        Product.find({userId:uid,isDeleted:false}).lean(),
        Transaction.find({userId:uid,isDeleted:false}).lean(),
      ]);
      const backupDate=new Date().toISOString().slice(0,10);
      await Backup.create({userId:uid,source:'SCHEDULED',label:`Automatic backup — ${backupDate}`,snapshot:clean({parties,products,transactions})});
      await Notification.create({userId:uid,type:'BACKUP_COMPLETED',title:'Automatic backup completed',message:`আজকের automatic backup সফলভাবে তৈরি হয়েছে।`,metadata:{date:backupDate}});
      await Backup.deleteMany({userId:uid,createdAt:{$lt:new Date(Date.now()-90*86400000)}});
      created++;
    }catch{}
  }
  return NextResponse.json({ok:true,created});
}
