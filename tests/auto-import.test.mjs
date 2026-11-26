import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMessage,importCandidate,sequenceWarnings,selectRecords} from '../app/src/main/assets/web/core.mjs';
const stamp=Date.parse('2026-01-02T12:00:00Z');
test('wrapped compact notification extracts recipient and preserves source number',()=>{
 const c=importCandidate('Test sender: #3 Test Person 861234567 Daşoguz 500\n$',stamp);
 assert.equal(c.record.recipient,'Test Person');assert.equal(c.record.serial,3);assert.equal(c.record.amountMinor,50000);assert.equal(c.record.day,'2026-01-02');assert.deepEqual(c.warnings,[]);
});
test('NBSP, multiple spaces and line wraps do not lose name',()=>{
 const p=parseMessage('Test: #12\nTest\u00a0Person  861234567  Mary  25,50 $');
 assert.equal(p.recipient,'Test Person');assert.equal(p.serial,12);assert.equal(p.currency,'USD');
});
test('incomplete, multiple amount and absent number require review',()=>{
 for(const text of ['#3 Test 861234567 Mary','Кому: Test\nТелефон: 861234567\nГород: Mary\n100 USD\n200 TMT','Кому: Test\nТелефон: 861234567\nГород: Mary\n100 USD'])assert.ok(importCandidate(text,stamp).warnings.length,text);
});
test('sequence gaps, repeats and out of order numbers warn without renumbering',()=>{
 const rs=[{day:'2026-01-02',serial:1}];
 assert.deepEqual(sequenceWarnings(rs,'2026-01-02',2),[]);
 assert.match(sequenceWarnings(rs,'2026-01-02',3)[0],/#2.*#3/);
 assert.match(sequenceWarnings(rs,'2026-01-02',1)[0],/уже существует/);
 assert.deepEqual(sequenceWarnings(rs,'2026-01-03',1),[]);
 assert.deepEqual(selectRecords([{...rs[0],recipient:'A',phone:'1'},{...rs[0],serial:3,recipient:'B',phone:'2'}]).map(r=>r.serial),[1,3]);
});
