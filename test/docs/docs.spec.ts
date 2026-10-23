import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  // Check the site independently of GitHub's avatar service availability.
  await page.route('https://github.com/*.png?size=*', (route) =>
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

const team: Array<{
  name: string;
  links: string[];
  sponsor?: string;
}> = [
  {
    name: 'Christopher Quadflieg',
    links: ['https://github.com/Shinigami92', 'https://mas.to/@Shini92'],
    sponsor: 'https://github.com/sponsors/Shinigami92',
  },
  {
    name: 'Breno A.',
    links: ['https://github.com/brenoepics'],
    sponsor: 'https://github.com/sponsors/brenoepics',
  },
  { name: 'Omar Diab', links: ['https://github.com/osdiab'] },
  { name: 'Gabriel Pereira', links: ['https://github.com/Creatixpy'] },
  {
    name: 'Theo Ephraim',
    links: ['https://github.com/theoephraim/'],
  },
  { name: 'Jan Doležel', links: ['https://github.com/dolezel'] },
  { name: 'Matthew Gertner', links: ['https://github.com/matthewgertner'] },
  { name: 'Jiří Staniševský', links: ['https://github.com/goce-cz'] },
  { name: 'Roman Vaivod', links: ['https://github.com/littlewhywhat'] },
];

async function expectTeamCards(page: Page): Promise<void> {
  const cards = page.locator('.VPTeamMembersItem');
  await expect(cards.locator('.name')).toHaveText(team.map(({ name }) => name));
  await expect(cards.locator('.title')).toHaveText([
    'Project Leader & Maintainer',
    'Co-Maintainer',
    'Co-Maintainer',
    'Core Contributor',
  ]);
  await expect(cards.locator('.desc')).toHaveText([
    'I am a developer constantly evolving, building my own projects and contributing to open source projects.',
  ]);
  for (const { name, links, sponsor } of team) {
    const card = cards.filter({
      has: page.getByRole('heading', { name, exact: true }),
    });
    await expect(
      card.getByRole('heading', { name, exact: true })
    ).toBeVisible();
    await expect(card.getByRole('img', { name, exact: true })).toBeVisible();

    const expectedLinks = sponsor ? [...links, sponsor] : links;
    await expect(card.getByRole('link')).toHaveCount(expectedLinks.length);
    expect(
      await card
        .getByRole('link')
        .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')))
    ).toEqual(expectedLinks);
    await expect(card.getByRole('link', { name: /^Sponsor\b/ })).toHaveCount(
      sponsor ? 1 : 0
    );
  }
}

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each
for (const { colorScheme, width } of [
  { colorScheme: 'light', width: 375 },
  { colorScheme: 'dark', width: 375 },
  { colorScheme: 'dark', width: 768 },
  { colorScheme: 'light', width: 960 },
  { colorScheme: 'light', width: 1280 },
  { colorScheme: 'dark', width: 1280 },
] as const) {
  test(`Team page in ${colorScheme} mode at ${width}px`, async ({ page }) => {
    const errors = watchBrowserErrors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await page.goto('./');

    if (width < 768) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
    }
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
    await expect(page.locator('.VPSidebar')).toHaveCount(0);

    await expectTeamCards(page);
    await expect(page.locator('.VPTeamPageSection .title-text')).toHaveText([
      'Core Contributors',
      'Team Emeriti',
    ]);
    await expect(
      page.getByRole('link', { name: 'mastodon', exact: true })
    ).toHaveCount(1);

    await expect
      .poll(() =>
        page.locator('html').evaluate((el) => el.classList.contains('dark'))
      )
      .toBe(colorScheme === 'dark');
    expect(
      await page
        .locator('html')
        .evaluate((root) => root.scrollWidth <= root.clientWidth)
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Team page remains readable without avatars', async ({ page }) => {
  // A successful response with no image data simulates an unavailable avatar.
  await page.route('https://github.com/*.png?size=*', (route) =>
    route.fulfill({ contentType: 'image/png', body: '' })
  );
  await page.goto('./team');

  const cards = page.locator('.VPTeamMembersItem');
  await expect
    .poll(() =>
      cards
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              'complete' in image &&
              image.complete === true &&
              'naturalWidth' in image &&
              image.naturalWidth === 0
          )
        )
    )
    .toBe(true);
  await expectTeamCards(page);
});
