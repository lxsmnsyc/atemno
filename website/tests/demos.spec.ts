import { expect, test } from '@playwright/test';

test('the counter counts and resets', async ({ page }) => {
  await page.goto('/docs/quick-start');
  const demo = page.locator('.demo').first();

  await demo.getByRole('button', { name: '+1' }).click();
  await demo.getByRole('button', { name: '+1' }).click();
  await expect(demo.locator('output')).toHaveText('Count: 2');

  await demo.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(demo.locator('output')).toHaveText('Count: 0');
});

test('two domains hold their own value for the same atom', async ({ page }) => {
  await page.goto('/docs/mental-model');
  const cards = page.locator('.demo .demo-card');

  await cards.nth(0).getByRole('button').click();
  await cards.nth(0).getByRole('button').click();
  await cards.nth(1).getByRole('button').click();

  await expect(cards.nth(0).getByRole('button')).toHaveText('Clicked 2 times');
  await expect(cards.nth(1).getByRole('button')).toHaveText('Clicked 1 times');
});

test('a failing computed rethrows until its input changes', async ({
  page,
}) => {
  await page.goto('/docs/errors');
  const demo = page.locator('.demo').first();
  const input = demo.getByRole('textbox', { name: 'JSON text' });
  const read = demo.getByRole('button', { name: 'Read parsed' });
  const note = demo.locator('.demo-note');

  await input.fill('{ nope');
  await read.click();
  await expect(note).toHaveText(/^Threw:/);

  await input.fill('{ "fixed": 1 }');
  await read.click();
  await expect(note).toHaveText('Read {"fixed":1}');
});

test('an action refuses a transfer it cannot cover', async ({ page }) => {
  await page.goto('/docs/actions');
  const demo = page.locator('.demo').first();

  await demo.getByRole('button', { name: 'Move $25' }).click();
  await expect(demo.locator('[data-checking]')).toHaveText('$75');
  await expect(demo.locator('[data-savings]')).toHaveText('$75');

  await demo.getByRole('button', { name: 'Move $500' }).click();
  await expect(demo.locator('.demo-note')).toHaveText(
    'Not enough in checking for $500.',
  );
  await expect(demo.locator('[data-checking]')).toHaveText('$75');
});

test('keyed atoms feed one computed', async ({ page }) => {
  await page.goto('/docs/keyed-state');
  const demo = page.locator('.demo').first();

  await expect(demo.locator('.demo-note')).toHaveText('3 left to do.');
  await demo.getByRole('checkbox').nth(1).check();
  await expect(demo.locator('.demo-note')).toHaveText('2 left to do.');
});

test('a demo shows the source it runs', async ({ page }) => {
  await page.goto('/docs/quick-start');
  const demo = page.locator('.demo').first();

  await demo.getByRole('tab', { name: 'Code' }).click();
  await expect(demo.locator('.demo-code pre')).toContainText(
    "const count = atom('count', 0);",
  );
});

test('code groups switch library together and copy the visible tab', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/comparison');
  const groups = page.locator('.code-group');
  await expect(
    groups.first().locator('.code-panel:not([hidden])'),
  ).toContainText("from 'atemno'");

  await groups.first().getByRole('button', { name: 'Jotai' }).click();

  // Every group with a Jotai tab follows.
  for (const group of await groups.all()) {
    await expect(group.getByRole('button', { name: 'Jotai' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(group.locator('.code-panel:not([hidden])')).toContainText(
      'jotai',
    );
  }

  await groups.first().getByRole('button', { name: 'Copy code' }).click();
  const copied = await page.evaluate(async () =>
    navigator.clipboard.readText(),
  );
  expect(copied).toContain("from 'jotai'");
  expect(copied).not.toContain('atemno');
});
