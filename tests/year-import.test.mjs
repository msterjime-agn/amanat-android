import test from 'node:test';
import assert from 'node:assert/strict';
import {screenDateWithYear,applyScreenSelection,sameHandover} from '../app/src/main/assets/web/core.mjs';
const now='2026-10-25',year={year:2026,confirmedOn:now};
const item=(label,body='#1 Test Person 861234567 Mary 100 $')=>({text:body,timestamp:Date.parse('2026-10-25T10:00:00Z'),screen:{day:'',warning:'Дата в чате «'+label+'» неполная или не распознана. Укажите дату с годом.'}});
test('one selected year resolves separate days without merging daily serials',()=>{
 const a=applyScreenSelection(item('24 окт.'),year,null,now),b=applyScreenSelection(item('25 окт.'),year,null,now);
 assert.equal(a.record.day,'2026-10-24');assert.equal(b.record.day,'2026-10-25');assert.equal(a.record.serial,1);assert.equal(b.record.serial,1);assert.deepEqual(a.warnings,[]);assert.deepEqual(b.warnings,[]);
});
test('old pending messages use quoted date; new ones use explicit context',()=>{
 assert.equal(applyScreenSelection(item('24 окт.'),year,null,now).record.day,'2026-10-24');
 const m=item('25 окт.');m.screen.context='24 окт.';assert.equal(applyScreenSelection(m,year,null,now).record.day,'2026-10-24');
});
test('day fallback never overwrites visible day/month, including unknown or future labels',()=>{
 const fallback={day:now,confirmedOn:now};
 assert.equal(applyScreenSelection(item('24 окт.'),year,fallback,now).record.day,'2026-10-24');
 assert.equal(applyScreenSelection(item('unknown'),year,fallback,now).record.day,'');
 assert.equal(applyScreenSelection(item('26 окт.'),year,fallback,now).record.day,'');
 const missing={...item(''),screen:{day:'',warning:'Дата не видна'}};assert.equal(applyScreenSelection(missing,year,fallback,now).record.day,now);
});
test('calendar dates, year boundaries and expired year selections remain strict',()=>{
 assert.equal(screenDateWithYear('29 февр.',2024,now),'2024-02-29');assert.equal(screenDateWithYear('29 февр.',2025,now),'');
 assert.equal(screenDateWithYear('31 апр.',2026,now),'');assert.equal(screenDateWithYear('31 дек.',2026,now),'');
 assert.equal(screenDateWithYear('31 дек.',2025,'2026-01-01'),'2025-12-31');assert.equal(screenDateWithYear('1 янв.',2026,'2026-01-01'),'2026-01-01');
 assert.equal(applyScreenSelection(item('24 окт.'),{year:2026,confirmedOn:'2026-10-24'},null,now).record.day,'');
});

test('notification and screen copies deduplicate by handover fields, never by number alone',()=>{
 const c=applyScreenSelection(item('24 окт.'),year,null,now).record;
 assert.equal(sameHandover(c,{...c,originalText:'Operator: '+c.originalText}),true);
 assert.equal(sameHandover({...c,city:'Дашогуз'},{...c,city:'Daşoguz'}),true);
 for(const change of [{day:'2026-10-25'},{amountMinor:20000},{city:'Ашхабад'},{recipient:'Other'},{phone:'862222222'},{serial:2}])assert.equal(sameHandover(c,{...c,...change}),false);
});
