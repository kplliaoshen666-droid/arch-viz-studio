import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Saved for human review (gitignored) — also closes the prior gap where the UI could not be
// screenshotted (Chrome extension was not connected). These are real headless renders.
const SHOTS = join('app', 'e2e', 'screenshots');

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // graph.json loads asynchronously; the shell mounts only once status === 'ready'.
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('app-error')).toHaveCount(0);
});

test('renders all four panes with real graph data', async ({ page }) => {
  await expect(page.getByTestId('pane-structure')).toBeVisible();
  await expect(page.getByTestId('pane-graph')).toBeVisible();
  await expect(page.getByTestId('pane-inspector')).toBeVisible();
  await expect(page.getByTestId('pane-diagram')).toBeVisible();

  // Center graph rendered real nodes.
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  // Structure tree rendered rows.
  await expect(page.locator('.av-tree-row').first()).toBeVisible();
  // Diagram pane rendered a Mermaid SVG.
  await expect(page.locator('.av-diagram-preview svg').first()).toBeVisible();

  await page.screenshot({ path: join(SHOTS, '01-overview.png') });
});

test('clicking a structure row populates the inspector', async ({ page }) => {
  const inspector = page.getByTestId('pane-inspector');
  await expect(inspector).toContainText('Select a node'); // empty state first

  await page.locator('.av-tree-row').first().click();

  await expect(inspector.locator('.av-detail-title')).toBeVisible();
  await expect(inspector.locator('.av-metrics')).toBeVisible();
  await expect(inspector).not.toContainText('Select a node to inspect');

  await page.screenshot({ path: join(SHOTS, '02-inspector.png') });
});

test('expand all / collapse all changes the rendered node count', async ({ page }) => {
  const nodes = page.locator('.react-flow__node');

  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(nodes.first()).toBeVisible();
  const collapsed = await nodes.count();

  await page.getByRole('button', { name: 'Expand all' }).click();
  // Expanding clusters reveals their members → strictly more nodes on the canvas.
  await expect.poll(() => nodes.count(), { timeout: 10_000 }).toBeGreaterThan(collapsed);

  await page.screenshot({ path: join(SHOTS, '03-expanded.png') });
});

test('search filters the structure tree', async ({ page }) => {
  const rows = page.locator('.av-tree-row');
  expect(await rows.count()).toBeGreaterThan(0);

  await page.getByPlaceholder(/search symbol/).fill('zzz_no_such_symbol_xyz');
  await expect(rows).toHaveCount(0); // nothing matches → tree empties

  await page.getByPlaceholder(/search symbol/).fill('');
  await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeGreaterThan(0);
});
