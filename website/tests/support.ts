import type { Page } from '@playwright/test';

/**
 * Collects console errors and warnings. A page that misbehaves still renders,
 * so the console is where most failures show up first.
 */
export function watchConsole(page: Page): string[] {
  const messages: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${page.url()} ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', error => {
    messages.push(`${page.url()} pageerror: ${error.message}`);
  });
  return messages;
}

/** Every docs page, read off the sidebar so new pages are covered too. */
export async function docPaths(page: Page): Promise<string[]> {
  await page.goto('/docs/introduction');
  return page
    .locator('.docs-sidebar .docs-nav a')
    .evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''));
}
