// Stopgap so theme/index.ts can import .vue files under the root `tsc`: it types
// every .vue module as a Layout, so component props are not checked (that needs
// vue-tsc). `vue` is not a direct dependency, so `import('vue')` would not
// resolve here and would silently become `any`.
declare module '*.vue' {
  const component: NonNullable<import('vitepress').Theme['Layout']>;
  export default component;
}
