// Checks that data.json has both languages everywhere and that referenced files exist.
// Run: node scripts/check-data.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data.json'), 'utf8'));
const LANGS = ['en', 'ar'];
const errors = [];
const fail = (msg) => errors.push(msg);

const isBilingual = (v) => v && typeof v === 'object' && LANGS.every((l) => typeof v[l] === 'string' && v[l].trim());
const needBilingual = (v, where) => { if (!isBilingual(v)) fail(`${where}: needs non-empty ${LANGS.join(' + ')} strings`); };
const textOrBilingual = (v, where) => { if (typeof v !== 'string') needBilingual(v, where); };

// ui.<lang> must have identical key trees
const shape = (o, path = '') => Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? shape(v, `${path}${k}.`) : [`${path}${k}`]);
const [enKeys, arKeys] = LANGS.map((l) => new Set(shape(data.ui[l])));
for (const k of enKeys) if (!arKeys.has(k)) fail(`ui.ar is missing "${k}"`);
for (const k of arKeys) if (!enKeys.has(k)) fail(`ui.en is missing "${k}"`);
if (data.ui.en.hero.roles.length !== data.ui.ar.hero.roles.length) fail('ui.hero.roles: en/ar lengths differ');

for (const [i, f] of data.features.entries()) { needBilingual(f.title, `features[${i}].title`); needBilingual(f.text, `features[${i}].text`); }
for (const [i, s] of data.services.entries()) { needBilingual(s.title, `services[${i}].title`); needBilingual(s.text, `services[${i}].text`); }
for (const [i, s] of data.process.entries()) { needBilingual(s.title, `process[${i}].title`); needBilingual(s.text, `process[${i}].text`); }
data.technologies.forEach((t, i) => textOrBilingual(t, `technologies[${i}]`));

const ids = new Set();
for (const [i, p] of data.projects.entries()) {
    const at = `projects[${p.id || i}]`;
    if (ids.has(p.id)) fail(`${at}: duplicate id`);
    ids.add(p.id);
    for (const key of ['title', 'subtitle', 'description']) needBilingual(p[key], `${at}.${key}`);
    p.tags.forEach((t, j) => textOrBilingual(t, `${at}.tags[${j}]`));
    if (!existsSync(join(root, p.image))) fail(`${at}: image not found (${p.image})`);
    if (p.link && !existsSync(join(root, p.link, 'index.html'))) fail(`${at}: link target not found (${p.link})`);
    for (const c of p.categories) if (!(c in data.ui.en.filters)) fail(`${at}: unknown category "${c}"`);
}

if (errors.length) {
    console.error(`data.json: ${errors.length} problem(s)\n - ${errors.join('\n - ')}`);
    process.exit(1);
}
console.log(`data.json OK: ${data.projects.length} projects, ${data.services.length} services, ${data.features.length} features, ${data.technologies.length} technologies (en + ar in sync)`);
