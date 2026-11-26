import test from 'node:test';
import assert from 'node:assert/strict';
import {dialPhone,callMatches,callIndex} from '../app/src/main/assets/web/core.mjs';
const record={id:'one',phone:'863075697',day:'2026-10-25',serial:1,recipient:'Бахрам',type:'money',amountMinor:10000,currency:'USD',parcelTotal:0,history:[],archived:false};
test('TM local trunk and international numbers match exactly; foreign numbers are not suffix matched',()=>{
 for(const number of ['863075697','63075697','+99363075697','99363075697','0099363075697','+993 (63) 07-56-97']){assert.equal(dialPhone(number),'+99363075697');assert.equal(callMatches([record],number).length,1);}
 for(const number of ['+9063075697','+763075697','63075698','','*123#','tel:63075697'])assert.equal(callMatches([record],number).length,0);
 assert.equal(dialPhone('+905551234567'),'+905551234567');
});
test('caller lookup includes paid, partial and archived cards; deleted excluded',()=>{
 const paid={...record,id:'paid',day:'2026-10-26',history:[{amountMinor:10000,parcels:0}],archived:true};
 const partial={...record,id:'partial',serial:2,history:[{amountMinor:4000,parcels:0}]};
 const removed={...record,id:'removed',deletedAt:'2026-11-26T00:00:00Z'};
 const records=[record,paid,partial,removed];
 assert.deepEqual(callMatches(records,'+99363075697').map(r=>r.id),['paid','one','partial']);
 const index=callIndex(records);assert.equal(index.length,3);assert.match(index.find(r=>r.id==='paid').label,/Выдано.*Архив/);assert.match(index.find(r=>r.id==='partial').label,/Выдано частично/);assert.match(index[0].label,/Бахрам.*№1.*25.10.2026/);
 assert.equal(callIndex([{...record,deletedAt:'now'}]).length,0);
});
test('native caller number lookup uses the same TM equivalence',async()=>{
 const {execFileSync}=await import('node:child_process');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../',import.meta.url)),out=mkdtempSync(join(tmpdir(),'amanat-calls-'));
 try{execFileSync('java',['-m','jdk.compiler/com.sun.tools.javac.Main','-d',out,join(root,'app/src/main/java/tm/ashyrov/amanat/CallNumbers.java'),join(root,'tests/CallNumbersTest.java')]);assert.match(execFileSync('java',['-cp',out,'tm.ashyrov.amanat.CallNumbersTest'],{encoding:'utf8'}),/passed/);}finally{rmSync(out,{recursive:true,force:true});}
});
