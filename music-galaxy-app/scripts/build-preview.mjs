import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
let html = await readFile(new URL('prototype/index.html', root), 'utf8');
const css = await readFile(new URL('prototype/src/style.css', root), 'utf8');
const modules = [];
for (const file of ['catalog.js', 'clouds.js', 'galaxy.js', 'player.js', 'app.js']) {
  const source = await readFile(new URL(`prototype/src/${file}`, root), 'utf8');
  modules.push(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
}
html = html.replace('<link rel="stylesheet" href="/src/style.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="/src/app.js"></script>', () => `<script type="module">${modules.join('\n')}</script>`)
  .replace('href="/" aria-label="音乐星际首页"', 'href="#" aria-label="音乐星际首页"');
await writeFile(new URL('preview.html', root), html);
console.log('已生成 preview.html，可直接双击打开，无需服务器。');
