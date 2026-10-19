/** Finds an element the demo's own markup is known to contain. */
export function query<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`The demo markup has no ${selector}.`);
  }
  return element;
}
