import { type Locator, expect, test } from '@playwright/test';

/** Each node's status, read off the classes the graph draws with. */
async function statuses(graph: Locator): Promise<Record<string, string>> {
  return graph
    .locator('g.graph-node')
    .evaluateAll(nodes =>
      Object.fromEntries(
        nodes.map(node => [
          node.querySelector('.graph-node-name')?.textContent ?? '',
          [...node.classList]
            .find(name => name.startsWith('status-'))
            ?.slice(7) ?? '',
        ]),
      ),
    );
}

test('the cart graph shows eager, lazy and released nodes as they really are', async ({
  page,
}) => {
  await page.goto('/explorer');
  const panel = page.locator('.explorer-panel:visible');

  // Observed: a write brings everything up to date at once.
  await panel.getByRole('button', { name: 'Increase price' }).click();
  await expect
    .poll(() => statuses(panel))
    .toMatchObject({
      subtotal: 'fresh',
      total: 'fresh',
      label: 'fresh',
    });

  // Unobserved: the derived nodes are released.
  await panel.getByRole('switch', { name: 'observe label' }).click();
  await expect
    .poll(() => statuses(panel))
    .toMatchObject({
      subtotal: 'released',
      total: 'released',
      label: 'released',
    });

  // Read once, then write: nodes are marked, and nothing runs.
  await panel.getByRole('button', { name: 'Read label' }).click();
  await panel.getByRole('button', { name: 'Increase price' }).click();
  await expect
    .poll(() => statuses(panel))
    .toMatchObject({
      subtotal: 'dirty',
      total: 'check',
      label: 'check',
    });

  // Reading settles it.
  await panel.getByRole('button', { name: 'Read label' }).click();
  await expect
    .poll(() => statuses(panel))
    .toMatchObject({
      subtotal: 'fresh',
      total: 'fresh',
      label: 'fresh',
    });
});

test('an equal result stops the update', async ({ page }) => {
  await page.goto('/explorer');
  await page.getByRole('tab', { name: 'Cutoff' }).click();
  const panel = page.locator('.explorer-panel:visible');
  const runs = (name: string) =>
    panel
      .locator('g.graph-node', { hasText: name })
      .locator('.graph-node-runs');

  await panel.getByRole('button', { name: 'Add 2' }).click();
  await expect(runs('parity')).toHaveText('×2');
  await expect(runs('message')).toHaveText('×1');
});
