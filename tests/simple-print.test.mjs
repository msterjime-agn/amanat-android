import test from 'node:test';
import assert from 'node:assert/strict';
import {printDocument} from '../app/src/main/assets/web/printing.mjs';
const record=(day,serial,history=[])=>({day,serial,recipient:'Aman',phone:'863075697',city:'Daşoguz',type:'money',amountMinor:100000,currency:'USD',parcelTotal:0,history});
test('simple print groups newest transfer day first and keeps serial order and payment marks',()=>{
 const html=printDocument([record('2026-10-24',1,[{date:'2026-10-25',amountMinor:100000,parcels:0}]),record('2026-10-25',2),record('2026-10-25',1)]);
 assert.ok(html.indexOf('25.10.2026')<html.indexOf('24.10.2026'));
 assert.match(html,/#1<\/span>[\s\S]*#2<\/span>[\s\S]*24\.10\.2026/);
 assert.match(html,/aria-label="Оплачено">✓/);assert.match(html,/aria-label="Не оплачено">☐/);
 assert.doesNotMatch(html,/<table|Итоги|Дата приёма/);assert.match(html,/A4 portrait/);
});
