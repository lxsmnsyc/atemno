import { type JSX, isServer } from '@solidjs/web';
import { createEffect } from 'solid-js';

const SITE = 'atemno';

/**
 * The title and description of the page rendered last on the server. Pages
 * are prerendered one at a time, so the prerender script reads them after
 * each render and writes them into that page's `<head>`.
 */
export const renderedMeta = { title: SITE, description: '' };

/**
 * Sets the page title and description. On the server it records them for
 * the prerender script. In the browser it writes them to the document
 * directly whenever the route changes.
 */
export default function PageMeta(props: {
  title?: string;
  description: string;
}): JSX.Element {
  if (isServer) {
    renderedMeta.title = props.title ? `${props.title} | ${SITE}` : SITE;
    renderedMeta.description = props.description;
  }
  // Created on both sides, since the effect takes a hydration id and the
  // server and the browser must hand out the same ones. Only the browser
  // runs it.
  createEffect(
    () => [props.title, props.description] as const,
    ([title, description]) => {
      document.title = title ? `${title} | ${SITE}` : SITE;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', description);
    },
  );
  return null;
}
