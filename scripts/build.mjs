import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function build(root = fileURLToPath(new URL('../', import.meta.url))) {
  const out = path.join(root, 'dist');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(path.join(root, 'index.html'), path.join(out, 'index.html'));
  await cp(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
  await cp(path.join(root, 'public'), out, { recursive: true });
  const files = [];
  const walk = async directory => {
    for (const entry of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, entry);
      if ((await stat(absolute)).isDirectory()) await walk(absolute);
      else files.push(path.relative(out, absolute).split(path.sep).join('/'));
    }
  };
  await walk(out);
  const precache = files.filter(file => !['sw.js', '.nojekyll'].includes(file));
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(await readFile(path.join(out, file)));
  const version = hash.digest('hex').slice(0, 16);
  const worker = (await readFile(path.join(out, 'sw.js'), 'utf8'))
    .replaceAll('__CACHE_VERSION__', version)
    .replace('__PRECACHE_URLS__', JSON.stringify(precache.map(file => './' + file)));
  await writeFile(path.join(out, 'sw.js'), worker);
  await writeFile(path.join(out, '.nojekyll'), '');
  console.log(`Built ${files.length + 1} files into ${out}; offline cache ${version}`);
  return { out, version, files: precache };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
