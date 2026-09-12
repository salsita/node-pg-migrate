import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Twoslash drives TypeScript's JS API, which TypeScript 7 no longer ships
import ts from 'typescript-6';
import type { DefaultTheme } from 'vitepress';
import { defineConfig } from 'vitepress';
import pkg from '../../package.json';

const repository = 'https://github.com/salsita/node-pg-migrate';
const base = '/node-pg-migrate/'; // for GitHub Pages
const siteUrl = `https://salsita.github.io${base}`;
export default defineConfig({
  title: 'node-pg-migrate',
  description:
    'Database migrations for Node.js, built for PostgreSQL. Write them in JavaScript, TypeScript or SQL, preview the exact SQL and roll back with inferred downs.',
  base,
  srcDir: 'src',
  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,
  sitemap: { hostname: siteUrl },

  // head entries are not prefixed with `base`; social previews need absolute URLs
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    // accent color of link embeds in Discord and others
    ['meta', { name: 'theme-color', content: '#d26b38' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'node-pg-migrate' }],
    ['meta', { property: 'og:image', content: `${siteUrl}og-image.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'node-pg-migrate: database migrations, made for PostgreSQL',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  // per-page title, description and URL for link previews and search engines
  transformHead({ pageData, title, description }) {
    const path = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '');
    const url = siteUrl + path;
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
    ];
  },

  markdown: {
    // `ts twoslash` code blocks show the real types on hover
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          tsModule: ts,
          tsLibDirectory: dirname(
            createRequire(import.meta.url).resolve('typescript-6')
          ),
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            types: ['node'],
            // resolve the package from source, so the docs build needs no `dist`
            paths: {
              'node-pg-migrate': [
                fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
              ],
            },
          },
        },
      }),
    ],
    languages: ['js', 'ts'],
  },

  themeConfig: {
    // the nav and hero logos come from theme/Layout.vue
    nav: navBarItems(),
    sidebar: sidebar(),

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: repository },
      { icon: 'npm', link: 'https://www.npmjs.com/package/node-pg-migrate' },
    ],

    editLink: {
      pattern: repository + '/edit/main/docs/src/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: `Released under the <a href="${repository}/blob/main/LICENSE">MIT License</a>.`,
    },
  },
});

function navBarItems(): DefaultTheme.NavItem[] {
  return [
    { text: 'Home', link: '/' },
    { text: 'Getting Started', link: '/getting-started' },
    {
      text: 'Migrations',
      link: '/migrations/',
      activeMatch: `^/migrations/`,
    },
    {
      text: pkg.version,
      items: [
        { text: 'Changelog', link: repository + '/blob/main/CHANGELOG.md' },
        { text: 'Releases', link: repository + '/releases' },
        { text: 'License', link: repository + '/blob/main/LICENSE' },
      ],
    },
  ];
}

function sidebar(): DefaultTheme.Sidebar {
  return [
    {
      base: '/',
      text: 'Reference',
      collapsed: false,
      items: sidebarReference(),
    },
    {
      base: '/migrations/',
      text: 'Defining Migrations',
      link: '/',
      collapsed: false,
      items: sidebarMigrations(),
    },
    {
      base: '/faq/',
      text: 'FAQ',
      collapsed: false,
      items: sidebarFAQ(),
    },
  ];
}

function sidebarReference(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Introduction',
      link: 'introduction',
    },
    {
      text: 'Getting Started',
      link: 'getting-started',
    },
    {
      text: 'Upgrading',
      link: 'upgrading',
    },
    {
      text: 'CLI',
      link: 'cli',
    },
    {
      text: 'Programmatic API',
      link: 'api',
    },
    {
      text: 'Migration Loading Strategies',
      link: 'migration-loading-strategies',
    },
  ];
}

function sidebarFAQ(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Typescript Migrations',
      link: 'typescript',
    },
    {
      text: 'Troubleshooting',
      link: 'troubleshooting',
    },
  ];
}

function sidebarMigrations(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Tables',
      link: 'tables',
    },
    {
      text: 'Columns',
      link: 'columns',
    },
    {
      text: 'Constraints',
      link: 'constraints',
    },
    {
      text: 'Indexes',
      link: 'indexes',
    },
    {
      text: 'Functions',
      link: 'functions',
    },
    {
      text: 'Triggers',
      link: 'triggers',
    },
    {
      text: 'Schemas',
      link: 'schemas',
    },
    {
      text: 'Sequences',
      link: 'sequences',
    },
    {
      text: 'Views',
      link: 'views',
    },
    {
      text: 'Materialized Views',
      link: 'mViews',
    },
    {
      text: 'Types',
      link: 'types',
    },
    {
      text: 'Domains',
      link: 'domains',
    },
    {
      text: 'Operators',
      link: 'operators',
    },
    {
      text: 'Roles',
      link: 'roles',
    },
    {
      text: 'Policies',
      link: 'policies',
    },
    {
      text: 'Extensions',
      link: 'extensions',
    },
    {
      text: 'Grants',
      link: 'grants',
    },
    {
      text: 'Casts',
      link: 'casts',
    },
    {
      text: 'Miscellaneous',
      link: 'misc',
    },
  ];
}
