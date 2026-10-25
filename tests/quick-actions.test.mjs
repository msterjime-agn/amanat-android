import test from 'node:test';
import assert from 'node:assert/strict';
import {completeToday,applyScreenDay,status,today,totals} from '../app/src/main/assets/web/core.mjs';
const day=today();
const rec={id:'test',serial:3,recipient:'Test Recipient',phone:'861234567',city:'Mary',type:'money',day,receivedDate:day,messageDate:day,currency:'USD',amountMinor:10000,parcelTotal:0,history:[]};
test('paid action settles only remaining balance with today date and preserves prior history',()=>{
 const prior={id:'partial',date:day,amountMinor:2000,parcels:0,deliveredTo:'Test Recipient'};
 const done=completeToday({...rec,history:[prior]},'Test Operator');
 assert.equal(done.history.length,2);assert.equal(done.history[1].amountMinor,8000);assert.equal(done.history[1].date,day);assert.equal(done.history[1].operator,'Test Operator');assert.equal(status(done),'done');assert.equal(totals(done).remaining,0);assert.deepEqual(done.history[0],prior);assert.throws(()=>completeToday(done),/уже выдана/);
});
test('parcel and combined handovers settle parcels as well as money',()=>{
 const r=completeToday({...rec,type:'both',parcelTotal:2});assert.equal(status(r),'done');assert.equal(r.history[0].parcels,2);
 const parcel=completeToday({...rec,type:'parcel',amountMinor:0,parcelTotal:1});assert.equal(parcel.history[0].amountMinor,0);assert.equal(status(parcel),'done');
});
test('only explicitly confirmed same-session day can unlock automatic screen imports',()=>{
 const item={text:'#5 Test Person 861234567 Mary 500 $',timestamp:Date.now(),screen:{day:'',warning:'Дата не видна'}};
 const selected={day,confirmedOn:day};
 assert.ok(applyScreenDay(item).warnings.length);
 assert.ok(applyScreenDay(item,{day,confirmedOn:'2020-01-01'}).warnings.length);
 const c=applyScreenDay(item,selected);assert.deepEqual(c.warnings,[]);assert.equal(c.record.serial,5);assert.equal(c.record.day,day);assert.match(c.record.note,/выбран вручную/);
 const known=applyScreenDay({...item,screen:{day:'2026-01-02',warning:''}},selected);assert.equal(known.record.day,'2026-01-02');
 const ambiguous=applyScreenDay({...item,text:'#5 Test 861234567 Mary'},selected);assert.ok(ambiguous.warnings.length);
});
