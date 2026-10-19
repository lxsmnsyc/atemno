import { expect, test } from '@playwright/test';

test('search finds a page and opens it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await page.getByPlaceholder('Search the docs').fill('lazy atom');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/docs\/lazy-atoms/);
});

test('the theme toggle switches and remembers the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');

  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('the mobile drawer opens the docs navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs/introduction');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();

  await drawer.getByRole('link', { name: 'Atoms', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/atoms/);
  await expect(drawer).toBeHidden();
});
