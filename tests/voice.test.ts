import {describe,expect,it} from 'vitest';
import {VoiceIntentSchema} from '@/lib/validations/voice';
import {parseSaleCommand} from '@/lib/voice-v2/saleParser';

const base={entity_type:'CUSTOMER' as const,entity_name:null,amount:null,quantity:null,unit:null,transaction_type:null,notes:null,phone:null,buy_price:null,sell_price:null,low_stock_threshold:null,party_type:null,items:[]};

describe('VoiceIntentSchema',()=>{it('accepts product creation',()=>{const r=VoiceIntentSchema.safeParse({...base,intent:'CREATE_PRODUCT',entity_type:'INVENTORY',entity_name:'চাল',quantity:10,unit:'kg',buy_price:50,sell_price:60,low_stock_threshold:3});expect(r.success).toBe(true)});it('rejects transaction without amount',()=>{const r=VoiceIntentSchema.safeParse({...base,intent:'CREATE_TRANSACTION',entity_name:'Rahim',transaction_type:'DUE_GIVEN'});expect(r.success).toBe(false)});it('accepts expense',()=>{const r=VoiceIntentSchema.safeParse({...base,intent:'CREATE_TRANSACTION',amount:500,transaction_type:'EXPENSE',notes:'Electricity'});expect(r.success).toBe(true)});});

describe('Voice V2 sale semantics',()=>{
  it('parses a named credit sale without an explicit price',()=>{
    const r=parseSaleCommand('রহিমকে ২ কেজি চাল বাকিতে বিক্রি করলাম');
    expect(r).not.toBeNull();
    expect(r?.action).toBe('CREATE_SALE');
    expect(r?.query).toBe('রহিম');
    expect(r?.entityName).toBe('চাল');
    expect(r?.quantity).toBe(2);
    expect(r?.unit).toBe('কেজি');
    expect(r?.paidAmount).toBe(0);
    expect(r?.unitPrice).toBeNull();
    expect(r?.amount).toBeNull();
  });
});
