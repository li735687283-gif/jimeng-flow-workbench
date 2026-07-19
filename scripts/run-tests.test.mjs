import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('package scripts use the runner and discovery filters recursively in sorted order', async (t) => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(
    packageJson.scripts.test,
    'node --test scripts/run-tests.test.mjs scripts/mok.test.mjs && npm run test:server && npm run test:web && npm run test:desktop',
  );
  assert.equal(packageJson.scripts['test:desktop'], 'node scripts/run-tests.mjs desktop');
  assert.equal(packageJson.scripts['test:server'], 'node scripts/run-tests.mjs server');
  assert.equal(packageJson.scripts['test:web'], 'node scripts/run-tests.mjs web');
  assert.equal(packageJson.scripts.lint, 'oxlint apps packages scripts');

  const { discoverTestFiles } = await import('./run-tests.mjs');
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'jimeng-test-discovery-'));
  t.after(() => rm(fixtureRoot, { force: true, recursive: true }));

  const serverTestDir = join(fixtureRoot, 'apps', 'server', 'test');
  await mkdir(join(serverTestDir, 'nested', 'deeper'), { recursive: true });
  await Promise.all([
    writeFile(join(serverTestDir, 'zeta.test.ts'), ''),
    writeFile(join(serverTestDir, 'alpha.test.tsx'), ''),
    writeFile(join(serverTestDir, 'nested', 'beta.test.ts'), ''),
    writeFile(join(serverTestDir, 'nested', 'deeper', 'gamma.test.tsx'), ''),
    writeFile(join(serverTestDir, 'nested', 'ignored.spec.ts'), ''),
    writeFile(join(serverTestDir, 'nested', 'ignored.test.js'), ''),
    writeFile(join(serverTestDir, 'nested', 'ignored.test.ts.bak'), ''),
  ]);

  assert.deepEqual(await discoverTestFiles(fixtureRoot, 'server'), [
    resolve(serverTestDir, 'alpha.test.tsx'),
    resolve(serverTestDir, 'nested', 'beta.test.ts'),
    resolve(serverTestDir, 'nested', 'deeper', 'gamma.test.tsx'),
    resolve(serverTestDir, 'zeta.test.ts'),
  ]);

  await assert.rejects(
    discoverTestFiles(fixtureRoot, 'unknown'),
    /Unknown test scope "unknown"\. Expected desktop, server, or web\./,
  );

  await mkdir(join(fixtureRoot, 'apps', 'web', 'test'), { recursive: true });
  await assert.rejects(
    discoverTestFiles(fixtureRoot, 'web'),
    /No test files found for scope "web"/,
  );
});
