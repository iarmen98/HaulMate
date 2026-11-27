declare const __APP_VERSION__: string;

declare module '*.log?raw' {
  const content: string;
  export default content;
}
