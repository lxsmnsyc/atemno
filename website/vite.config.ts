import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import solid from '@solidjs/vite-plugin';
import { type Plugin, defineConfig } from 'vite';
import content from './plugins/content.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Answers paths that have no prerendered page with `404.html`, as a static
 * host does, instead of the preview server's fallback to `index.html`, which
 * would hydrate the home page's markup at another route.
 */
function previewNotFound(): Plugin {
  return {
    name: 'atemno-preview-not-found',
    configurePreviewServer(server) {
      const outDir = path.resolve(
        server.config.root,
        server.config.build.outDir,
      );
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost')
          .pathname;
        if (path.extname(pathname)) {
          next();
          return;
        }
        const page =
          pathname === '/'
            ? '/index.html'
            : `${pathname.replace(/\/$/, '')}.html`;
        if (existsSync(path.join(outDir, page))) {
          next();
          return;
        }
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html');
        response.end(readFileSync(path.join(outDir, '404.html')));
      });
    },
  };
}

export default defineConfig({
  plugins: [
    content(ROOT),
    // Pages are prerendered by `scripts/prerender.ts` and hydrated in the
    // browser. There is no server at runtime, so no start mode.
    solid({ ssr: true }),
    previewNotFound(),
  ],
  build: {
    // The prerender script hands the client manifest to the server render, so
    // each page preloads the chunks of its lazy route before hydrating.
    manifest: true,
  },
  server: {
    fs: {
      // The header reads the library's version from the workspace.
      allow: [ROOT],
    },
  },
});
