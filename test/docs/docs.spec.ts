import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import members from '../../docs/src/team/members.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  // Check the site independently of GitHub's avatar service availability.
  await page.route('https://github.com/*.png*', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"/>',
    })
  );
});

// `pnpm run docs:build` writes the sitemap, so it lists every page of the site
const sitemapPath = new URL(
  '../../docs/.vitepress/dist/sitemap.xml',
  import.meta.url
);

function builtPages(): string[] {
  let sitemap: string;
  try {
    sitemap = readFileSync(sitemapPath, 'utf8');
  } catch {
    throw new Error('The docs are not built; run `pnpm run docs:build` first');
  }

  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, loc]) => new URL(loc).pathname
  );
}

// Everything the browser reports while a page loads and runs. The docs build
// stays green for client-only breakage (e.g. the Twoslash client failing to
// patch FloatingVue), so this is what surfaces it.
function watchBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`uncaught: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    errors.push(
      `request failed: ${request.url()} (${request.failure()?.errorText})`
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each
for (const path of builtPages()) {
  test(`${path} loads and hydrates without errors`, async ({ page }) => {
    const errors = watchBrowserErrors(page);

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    // Vue exposes the app on its container once the client has hydrated the
    // server-rendered HTML
    await expect
      .poll(() => page.locator('#app').evaluate((el) => '__vue_app__' in el))
      .toBe(true);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
}

test('Twoslash hover popups show the real types', async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.goto('./');

  await page
    .locator('.twoslash-hover', { hasText: 'createTable' })
    .first()
    .hover();

  const popup = page.locator('.v-popper__popper--shown .twoslash-popup-code');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('MigrationBuilder.createTable');

  expect(errors).toEqual([]);
});

const team = [
  ...members.maintainers,
  ...members.contributors,
  ...members.emeriti,
];

test('Team navigation opens the team page', async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('./');

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const teamLink = page.getByRole('link', { name: 'Team', exact: true });
  await expect(teamLink).toBeVisible();
  await expect(teamLink).toHaveAttribute('href', '/node-pg-migrate/team');
  await teamLink.click();

  await expect(page).toHaveURL(/\/node-pg-migrate\/team$/);
  await expect(page).toHaveTitle('Team | node-pg-migrate');
  await expect(
    page.getByRole('heading', { name: 'Meet the Team', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Core Contributors', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Team Emeriti', exact: true })
  ).toBeVisible();

  const cards = page.locator('.VPTeamMembersItem');
  await expect(cards).toHaveCount(team.length);
  await expect(cards.locator('.name')).toHaveText(team.map(({ name }) => name));
  await expect(page.locator('.VPSidebar')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
