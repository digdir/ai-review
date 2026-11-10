declare module 'virtual:docs' {
  const pages: import('./lib/markdown').DocPage[];
  export default pages;
}
