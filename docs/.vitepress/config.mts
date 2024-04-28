import { DefaultTheme, defineConfig } from 'vitepress';

import pkg from '../../package.json';

const repository = 'https://github.com/salsita/node-pg-migrate';
export default defineConfig({
  title: 'node-pg-migrate',
  description: 'Postgresql database migration management tool',
  base: '/node-pg-migrate/', // for GitHub Pages
  srcDir: 'src',
  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,

  themeConfig: {
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
      text: 'CLI',
      link: 'cli',
    },
    {
      text: 'Programmatic API',
      link: 'api',
    },
  ];
}

function sidebarFAQ(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Transpiling Migrations',
      link: 'transpiling',
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
