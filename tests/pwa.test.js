import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const workerTemplate = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://example.github.io';
const scope = `${origin}/90day-fitness/`;

function worker({ offline = false, cachedShell = true } = {}) {
  const handlers = {};
  const deleted = [];
  const cache = new Map([[scope + 'index.html', { shell: true }], [scope + 'src/app.js', { script: true }]]);
  if (!cachedShell) cache.delete(scope + 'index.html');
  const storage = {
    open: async () => ({
      addAll: async urls => urls.forEach(url => cache.set(url, { precached: true })),
      match: async request => cache.get(typeof request === 'string' ? request : request.url),
      put: async (request, response) => cache.set(request.url, response),
    }),
    keys: async () => ['90day-fitness-old', '90day-fitness-test', 'other-app'],
    delete: async key => deleted.push(key),
  };
  const self = {
    registration: { scope },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    clients: { matchAll: async () => [], claim: async () => {} },
    skipWaiting: () => { self.skipped = true; },
  };
  vm.runInNewContext(workerTemplate.replaceAll('__CACHE_VERSION__', 'test').replace('__PRECACHE_URLS__', JSON.stringify(['./index.html', './src/app.js'])), {
    self, caches: storage, URL, Set,
    fetch: async () => {
      if (offline) throw new Error('offline');
      return { ok: true, type: 'basic', clone() { return this; }, network: true };
    },
  });
  const dispatchFetch = async (request) => {
    let response;
    handlers.fetch({ request, respondWith: promise => { response = promise; } });
    return response;
  };
  return { handlers, dispatchFetch, deleted, self };
}

test('production build precaches every local resource and revisions on content changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'fitness-build-'));
  try {
    await mkdir(path.join(root, 'src'));
    await cp(new URL('../public', import.meta.url), path.join(root, 'public'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), '<main>Fitness</main>');
    await writeFile(path.join(root, 'src/app.js'), 'export const version = 1;');
    const first = await build(root);
    const second = await build(root);
    assert.equal(first.version, second.version, 'builds are deterministic');
    const output = await readFile(path.join(root, 'dist/sw.js'), 'utf8');
    assert.ok(!output.includes('__PRECACHE_URLS__'));
    assert.ok(!output.includes('__CACHE_VERSION__'));
    for (const asset of first.files) assert.ok(output.includes('./' + asset));
    await writeFile(path.join(root, 'src/app.js'), 'export const version = 2;');
    assert.notEqual(first.version, (await build(root)).version);
    assert.equal(await readFile(path.join(root, 'dist/.nojekyll'), 'utf8'), '');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('offline navigation under GitHub Pages project path returns the app shell', async () => {
  const { dispatchFetch } = worker({ offline: true });
  const response = await dispatchFetch({ method: 'GET', mode: 'navigate', url: scope + 'anything' });
  assert.equal(response.shell, true);
});

test('online navigation retains the active release shell alongside its cached scripts', async () => {
  const { dispatchFetch } = worker();
  const response = await dispatchFetch({ method: 'GET', mode: 'navigate', url: scope });
  assert.equal(response.shell, true);
  assert.equal(response.network, undefined);
  const script = await dispatchFetch({ method: 'GET', mode: 'cors', url: scope + 'src/app.js' });
  assert.equal(script.script, true);
});

test('navigation can recover from a missing shell cache while online', async () => {
  const { dispatchFetch } = worker({ cachedShell: false });
  const response = await dispatchFetch({ method: 'GET', mode: 'navigate', url: scope });
  assert.equal(response.network, true);
});

test('offline precached JS is available under the project path', async () => {
  const { dispatchFetch } = worker({ offline: true });
  const response = await dispatchFetch({ method: 'GET', mode: 'cors', url: scope + 'src/app.js' });
  assert.equal(response.script, true);
});

test('service worker leaves unrelated origins, paths, POST and unknown resources untouched', async () => {
  const { dispatchFetch } = worker();
  const requests = [
    { method: 'POST', mode: 'cors', url: scope + 'src/app.js' },
    { method: 'GET', mode: 'navigate', url: origin + '/other/' },
    { method: 'GET', mode: 'cors', url: 'https://elsewhere.example/src/app.js' },
    { method: 'GET', mode: 'cors', url: scope + 'api' },
  ];
  for (const request of requests) assert.equal(await dispatchFetch(request), undefined);
});

test('activation clears only prior app caches and update message opts into waiting worker activation', async () => {
  const { handlers, deleted, self } = worker();
  let work;
  handlers.activate({ waitUntil: promise => { work = promise; } });
  await work;
  assert.deepEqual(deleted, ['90day-fitness-old']);
  handlers.message({ data: { type: 'other' } });
  assert.equal(self.skipped, undefined);
  handlers.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(self.skipped, true);
});

test('manifest uses relative app scope, standalone display, and both normal and maskable icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('./'));
    const content = await readFile(new URL('../public/' + icon.src.slice(2), import.meta.url));
    assert.ok(content.length > 0);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});
