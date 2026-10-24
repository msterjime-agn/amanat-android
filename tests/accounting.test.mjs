import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,normalizePhone,today,validDate,totals,status,validateRecord,selectRecords,aggregate,parseMessage,exportCsv,validateBackup} from '../app/src/main/assets/web/core.mjs';
import {printDocument} from '../app/src/main/assets/web/printing.mjs';

const rec=(overrides={})=>({id:'record-1',serial:1,day:'2026-01-02',receivedDate:'2026-01-02',messageDate:'2026-01-02',recipient:'Тестовый получатель',phone:'+99365123456',city:'Дашогуз',type:'money',amountMinor:10000,currency:'USD',parcelTotal:0,parcelDesc:'',sender:'',note:'',originalText:'',history:[],archived:false,createdAt:'2026-01-02T10:00:00Z',updatedAt:'2026-01-02T10:00:00Z',...overrides});
const issue=(overrides={})=>({id:'issue-1',date:'2026-01-03',amountMinor:4000,parcels:0,deliveredTo:'Получатель',...overrides});

test('money is parsed in integer minor units, without float rounding',()=>{
  assert.equal(parseMoney('0.29'),29);assert.equal(parseMoney('1 234,56'),123456);assert.equal(parseMoney('1,234.56'),123456);assert.equal(parseMoney('1.234,56'),123456);assert.equal(parseMoney('100'),10000);
  for(const value of ['-1','1.005','1e3','NaN','1,2,3','Infinity'])assert.throws(()=>parseMoney(value));
});
test('dates are valid calendar dates and local day is Ashgabat',()=>{
  assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-13-01'),false);
  assert.equal(today(new Date('2026-01-01T20:00:00Z')),'2026-01-02');
});
test('phones normalize without confusing name or date',()=>{
  assert.equal(normalizePhone('65 123456'),'+99365123456');assert.equal(normalizePhone('0099365123456'),'+99365123456');assert.equal(normalizePhone('+90 (555) 123-45-67'),'+905551234567');
});
test('partial payout and parcel issuance have separate balances',()=>{
  const r=rec({type:'both',parcelTotal:2,history:[issue({parcels:1})]});
  assert.deepEqual(totals(r),{paid:4000,parcels:1,remaining:6000,parcelsRemaining:1});assert.equal(status(r),'partial');
  const done=rec({type:'both',parcelTotal:2,history:[issue({amountMinor:10000,parcels:2})]});assert.equal(status(done),'done');
  assert.equal(status(rec({type:'both',parcelTotal:2,history:[issue({amountMinor:10000})]})),'partial');
});
test('invalid payout, changed received date and overpayment are rejected',()=>{
  assert.throws(()=>validateRecord(rec({history:[issue({amountMinor:10001})]})),/меньше/);
  assert.throws(()=>validateRecord(rec({history:[issue({amountMinor:-1})]})),/выдачи/);
  assert.throws(()=>validateRecord(rec({history:[issue({date:'2026-01-01'})]})),/Дата выдачи/);
  assert.throws(()=>validateRecord(rec({type:'parcel',amountMinor:0,parcelTotal:0})),/мест/);
  assert.throws(()=>validateRecord(rec({history:[issue({amountMinor:0})]})),/выдачи/);
  assert.doesNotThrow(()=>validateRecord(rec()));
});
test('voiding preserves history but restores outstanding balance',()=>{
  const r=rec({history:[issue({voidedAt:'2026-01-04',voidReason:'Ошибка'})]});
  assert.equal(totals(r).remaining,10000);assert.equal(status(r),'waiting');assert.equal(r.history.length,1);
});
test('same daily serial is legitimate on two dates and print preserves it',()=>{
  const a=rec(),b=rec({id:'record-2',day:'2026-01-03',receivedDate:'2026-01-03'});
  assert.doesNotThrow(()=>validateBackup({app:'amanat',version:1,records:[a,b],sequences:{'2026-01-02':1,'2026-01-03':1}}));
  const html=printDocument([a,b],{generatedDay:'2026-01-04'});assert.match(html,/02\.01\.2026/);assert.match(html,/03\.01\.2026/);assert.equal((html.match(/<td>1<\/td>/g)||[]).length,2);
});
test('same-day duplicate serial and malformed backup are rejected',()=>{
  const a=rec(),b=rec({id:'record-2'});
  assert.throws(()=>validateBackup({app:'amanat',version:1,records:[a,b],sequences:{}}),/повторяется дневной номер/);
  assert.throws(()=>validateBackup({records:[]}));assert.throws(()=>validateBackup({app:'amanat',version:1,records:[a],sequences:{bad:1}}));
});
test('filters retain serials and search normalizes phone digits',()=>{
  const a=rec({serial:17}),b=rec({id:'record-2',serial:23,city:'Мары',history:[issue({date:'2026-01-04',amountMinor:10000})]});
  assert.deepEqual(selectRecords([a,b],{status:'open'}).map(x=>x.serial),[17]);
  assert.deepEqual(selectRecords([a,b],{basis:'issued',from:'2026-01-04',to:'2026-01-04'}).map(x=>x.serial),[23]);
  assert.equal(selectRecords([a],{q:'65 123 456'}).length,1);
});
test('currency totals never combine USD and TMT; archive retains turnover',()=>{
  const a=rec({history:[issue({amountMinor:10000})],archived:true}),b=rec({id:'record-2',currency:'TMT',amountMinor:20000});
  const g=aggregate([a,b]);assert.equal(g.groups.USD.received,10000);assert.equal(g.groups.TMT.received,20000);assert.equal(g.groups.USD.issued,10000);assert.equal(g.groups.USD.outstanding,0);
});
test('period cash balance reconciles even if received earlier than issue period',()=>{
  const r=rec({history:[issue({date:'2026-01-05'})]});
  const g=aggregate([r],'2026-01-05','2026-01-06').groups.USD;
  assert.equal(g.opening,10000);assert.equal(g.received,0);assert.equal(g.issued,4000);assert.equal(g.closing,6000);assert.equal(g.opening+g.received-g.issued,g.closing);
  assert.equal(aggregate([r],'2026-01-03','2026-01-04').groups.USD.closing,10000);
});
test('Russian IMO message is suggested with exact currency and phone',()=>{
  const p=parseMessage('Получатель: Тестовый получатель\nТелефон: +993 65 123456\nГород: Дашогуз\nСумма: 100 USD');
  assert.equal(p.recipient,'Тестовый получатель');assert.equal(p.phone,'+99365123456');assert.equal(p.amount,'100');assert.equal(p.currency,'USD');assert.equal(p.city,'Дашогуз');
});
test('ambiguous message does not silently choose a financial amount',()=>{
  const p=parseMessage('Кому: Получатель\nТел: 65123456\n100 USD\n350 TMT\nДашогуз');
  assert.equal(p.amount,'');assert.equal(p.currency,'');assert.ok(p.warnings.some(x=>x.includes('несколько сумм')));
});
test('ambiguous decimal/grouping notation never parses a partial number',()=>{
  for(const raw of ['USD 1,000','1,000 USD','USD 100.005','100.005 USD']){
    const p=parseMessage('Кому: Тест\nТелефон: +99365123456\nГород: Мары\n'+raw);
    assert.equal(p.amount,'',raw);assert.equal(p.currency,'',raw);assert.ok(p.warnings.some(x=>x.includes('неоднозначен')));
  }
});
test('Turkish and Turkmen labels are supported',()=>{
  const p=parseMessage('Alıcı: Test\nTelefon: +99365123456\nŞehir: Aşgabat\nTutar: 25,50 USD\nKargo: kitap\n2 adet');
  assert.equal(p.recipient,'Test');assert.equal(p.type,'both');assert.equal(p.parcelTotal,'2');assert.equal(p.currency,'USD');assert.equal(parseMoney(p.amount),2550);
});
test('CSV protects formulas and HTML output escapes supplied names',()=>{
  const r=rec({recipient:'=1+1',note:'<script>alert(1)</script>'});assert.ok(exportCsv([r]).includes('"\'=1+1"'));
  const html=printDocument([rec({recipient:'<script>alert(1)</script>'})],{generatedDay:'2026-01-04'});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
