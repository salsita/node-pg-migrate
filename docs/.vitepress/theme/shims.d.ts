declare module '*.vue' {
  const component: NonNullable<import('vitepress').Theme['Layout']>;
  export default component;
}
