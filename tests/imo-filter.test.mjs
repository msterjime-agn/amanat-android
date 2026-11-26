import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('production IMO Java filter checks group identity with API 26/27/28/35 metadata', t => {
  const classes = mkdtempSync(join(tmpdir(), 'amanat-imo-filter-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    // Invoke the JDK compiler module so a separate javac binary is unnecessary.
    execFileSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '--release', '17',
      '-encoding', 'UTF-8', '-d', classes,
      join(root, 'app/src/main/java/tm/ashyrov/amanat/ImoGroupFilter.java'),
      join(root, 'tests/ImoGroupFilterTest.java')],
      {encoding: 'utf8', timeout: 30000, stdio: 'pipe'});
    const output = execFileSync('java', ['-cp', classes, 'tm.ashyrov.amanat.ImoGroupFilterTest'],
      {encoding: 'utf8', timeout: 30000, stdio: 'pipe'});
    t.diagnostic(output.trim());
  } finally {
    rmSync(classes, {recursive: true, force: true});
  }
});
