import {
  type AssetManifest,
  generateHydrationScript,
  renderToStream,
} from '@solidjs/web';
import App from './App';
import { renderedMeta } from './components/PageMeta';

export interface RenderedPage {
  html: string;
  head: string;
  title: string;
  description: string;
}

/**
 * Renders the page at `url` to HTML, waiting for its lazy route to load.
 * The prerender script splices the result into the client's `index.html`.
 */
export async function render(
  url: string,
  manifest: AssetManifest,
): Promise<RenderedPage> {
  let head = '';
  const html = await renderToStream(() => <App url={url} />, {
    manifest,
    onHead(value) {
      head = value;
    },
  });
  return {
    html,
    head: generateHydrationScript() + head,
    ...renderedMeta,
  };
}
