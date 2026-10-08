// Typed through ./facts.ts and ./content.ts; the producers (vite-plugin-facts.ts,
// vite-plugin-content.ts) are checked against SquashFacts and ContentManifest.
declare module 'virtual:squash-facts' {
  const facts: unknown
  export default facts
}

declare module 'virtual:squash-content' {
  const content: unknown
  export default content
}
