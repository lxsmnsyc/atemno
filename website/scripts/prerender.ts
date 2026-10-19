// Writes every page of the site to a static HTML file in `dist`. Pages are
// found by following internal links, starting from the home page. Each one is
// rendered by the server bundle and spliced into the client's `index.html`,
// which the browser then hydrates.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetManifest } from '@solidjs/web';
import type { RenderedPage } from '../src/entry-server.tsx';

const DIST = path.resolve(import.meta.dirname, '../dist');
const SERVER = path.resolve(import.meta.dirname, '../dist-server');
const LINK_PATTERN = /href="(\/[^"#?]*)/g;
const TRAILING_SLASH = /\/$/;
const ROOT = '<div id="root"></div>';

const server = (await import(path.join(SERVER, 'entry-server.js'))) as {
  render: (url: string, manifest: AssetManifest) => Promise<RenderedPage>;
};
const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(
  await readFile(path.join(DIST, '.vite/manifest.json'), 'utf8'),
) as AssetManifest;
manifest._base = '/';

async function render(url: string): Promise<RenderedPage> {
  return server.render(url, manifest);
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceOnce(
  source: string,
  pattern: string | RegExp,
  value: string,
): string {
  if (!source.match(pattern)) {
    throw new Error(`index.html has no ${String(pattern)} to replace.`);
  }
  return source.replace(pattern, () => value);
}

const LINK_TAG = /<link\b[^>]*\bhref="([^"]+)"[^>]*>/g;

/** Drops the stylesheets and preloads the template already links to. */
function withoutLinksIn(source: string, head: string): string {
  return head.replace(LINK_TAG, (tag, href: string) =>
    source.includes(`href="${href}"`) ? '' : tag,
  );
}

function toDocument(page: RenderedPage): string {
  let html = template;
  html = replaceOnce(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeHTML(page.title)}</title>`,
  );
  html = replaceOnce(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHTML(page.description)}" />`,
  );
  html = replaceOnce(
    html,
    '</head>',
    `${withoutLinksIn(template, page.head)}</head>`,
  );
  return replaceOnce(html, ROOT, `<div id="root">${page.html}</div>`);
}

function outputFile(pathname: string): string {
  return pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`;
}

function isPage(pathname: string): boolean {
  return !path.extname(pathname);
}

async function write(file: string, page: RenderedPage): Promise<void> {
  const target = path.join(DIST, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, toDocument(page));
}

const queue = ['/'];
const seen = new Set(queue);

for (let i = 0; i < queue.length; i++) {
  const pathname = queue[i];
  const page = await render(pathname);
  if (page.html.includes('class="not-found"')) {
    throw new Error(`${pathname} is linked from the site but has no page.`);
  }
  await write(outputFile(pathname), page);
  console.log(`prerendered ${pathname}`);

  for (const [, href] of page.html.matchAll(LINK_PATTERN)) {
    const next = href.replace(TRAILING_SLASH, '') || '/';
    if (isPage(next) && !seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  }
}

// Static hosts serve `404.html` for paths that have no file.
await write('404.html', await render('/404'));
console.log('prerendered 404');

// The static files replace the server bundle, and the manifest has been used.
await rm(SERVER, { recursive: true });
await rm(path.join(DIST, '.vite'), { recursive: true });
