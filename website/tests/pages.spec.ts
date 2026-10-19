import { expect, test } from '@playwright/test';
import { docPaths, watchConsole } from './support';

test('every docs page renders with a title, a lead and no console noise', async ({
  page,
}) => {
  test.slow();
  const messages = watchConsole(page);
  const paths = await docPaths(page);
  expect(paths.length).toBeGreaterThan(20);

  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('.docs-header h1'), path).toBeVisible();
    await expect(page.locator('.docs-lead'), path).not.toBeEmpty();
    await expect(page, path).toHaveTitle(/\| atemno$/);
  }

  expect(messages).toEqual([]);
});

test('every internal link in the docs leads to a real page', async ({
  page,
}) => {
  test.slow();
  const paths = await docPaths(page);
  const targets = new Set<string>();

  for (const path of paths) {
    await page.goto(path);
    const hrefs = await page
      .locator('.prose a[href^="/"]')
      .evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      targets.add(href.split('#')[0]);
    }
  }

  for (const target of targets) {
    await page.goto(target);
    await expect(
      page.locator('.not-found'),
      `${target} is a dead link`,
    ).toHaveCount(0);
  }
});

test('the home page, the explorer and the 404 page render cleanly', async ({
  page,
}) => {
  const messages = watchConsole(page);

  await page.goto('/');
  await expect(page.locator('.hero-title')).toBeVisible();
  await expect(page.locator('.graph-view')).toBeVisible();

  await page.goto('/explorer');
  await expect(page.locator('h1')).toHaveText('Watch the graph work');

  // The 404 status is the one console message expected.
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('.not-found h1')).toBeVisible();
  await expect(page).toHaveTitle('Page not found | atemno');

  expect(
    messages.filter(message => !message.includes('status of 404')),
  ).toEqual([]);
});

test('pages arrive prerendered, with their own title and description', async ({
  request,
}) => {
  const response = await request.get('/docs/propagation');
  const html = await response.text();

  expect(html).toContain('<title>How updates propagate | atemno</title>');
  expect(html).toContain('<h1>How updates propagate</h1>');
  expect(html).toContain('class="graph-view"');
  expect(html.match(/<meta name="description"/g)).toHaveLength(1);
});

test('the client router still navigates between prerendered pages', async ({
  page,
}) => {
  const messages = watchConsole(page);
  await page.goto('/docs/atoms');
  await page
    .locator('.docs-sidebar')
    .getByRole('link', { name: 'Computeds' })
    .click();

  await expect(page).toHaveURL('/docs/computeds');
  await expect(page.locator('.docs-header h1')).toHaveText('Computeds');
  await expect(page).toHaveTitle('Computeds | atemno');
  expect(messages).toEqual([]);
});
