import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inboxCandidate} from '../app/src/main/assets/web/core.mjs';
test('screen import never replaces unknown historical date with capture date',()=>{
 const item={text:'#3 Test Person 861234567 Mary 500 $',timestamp:Date.parse('2026-10-25T10:00:00Z'),screen:{day:'',warning:'Дата без года'}};
 const c=inboxCandidate(item);assert.equal(c.record.day,'');assert.equal(c.parsed.day,'');assert.ok(c.warnings.includes('Дата без года'));
 const known=inboxCandidate({...item,screen:{day:'2026-01-02',warning:''}});
 assert.equal(known.record.day,'2026-01-02');assert.equal(known.record.receivedDate,'2026-01-02');assert.deepEqual(known.warnings,[]);
});
test('production screen reader extracts synthetic IMO tree with strict binding',t=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),classes=mkdtempSync(join(tmpdir(),'amanat-screen-'));
 try{
  execFileSync('java',['-m','jdk.compiler/com.sun.tools.javac.Main','--release','17','-encoding','UTF-8','-d',classes,join(root,'app/src/main/java/tm/ashyrov/amanat/ImoScreenReader.java'),join(root,'tests/ImoScreenReaderTest.java')],{timeout:30000});
  t.diagnostic(execFileSync('java',['-cp',classes,'tm.ashyrov.amanat.ImoScreenReaderTest',join(root,'tests/fixtures/imo-screen-synthetic.xml')],{encoding:'utf8',timeout:30000}).trim());
 }finally{rmSync(classes,{recursive:true,force:true});}
});
