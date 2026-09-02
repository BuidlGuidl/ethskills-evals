// solc ships no TypeScript types; we only use the standard-JSON entrypoint.
declare module "solc" {
  interface ImportResolution {
    contents?: string;
    error?: string;
  }
  interface Solc {
    version(): string;
    compile(
      input: string,
      callbacks?: { import: (path: string) => ImportResolution },
    ): string;
  }
  const solc: Solc;
  export default solc;
}
