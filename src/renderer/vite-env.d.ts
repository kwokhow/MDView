/// <reference types="vite/client" />

// CSS imported with the ?inline query returns its text as a string.
declare module '*.css?inline' {
  const css: string
  export default css
}
