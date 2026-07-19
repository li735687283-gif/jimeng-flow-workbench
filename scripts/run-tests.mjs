import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scopeDirectories = new Map([
  ['server', join('apps', 'server', 'test')],
  ['desktop', join('apps', 'desktop', 'test')],
  ['web', join('apps', 'web', 'test')],
]);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function discoverTestFiles(rootDirectory, scope) {
  const relativeTestDirectory = scopeDirectories.get(scope);
  if (!relativeTestDirectory) {
    throw new Error(`Unknown test scope "${scope}". Expected desktop, server, or web.`);
  }

  const testDirectory = resolve(rootDirectory, relativeTestDirectory);
  const testFiles = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
        testFiles.push(entryPath);
      }
    }
  }

  await visit(testDirectory);
  testFiles.sort();

  if (testFiles.length === 0) {
    throw new Error(`No test files found for scope "${scope}" under ${testDirectory}.`);
  }

  return testFiles;
}

async function run(scope) {
  const testFiles = await discoverTestFiles(repositoryRoot, scope);
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });

  return new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('close', (exitCode) => resolvePromise(exitCode ?? 1));
  });
}

const invokedAsScript =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  try {
    process.exitCode = await run(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
