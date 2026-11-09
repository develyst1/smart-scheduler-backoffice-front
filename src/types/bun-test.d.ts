// The front has no test runner of its own; `bun test` runs the *.test.ts(x) files. This shim only keeps `tsc` quiet about `bun:test`.
declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const expect: (actual: unknown) => any;
}
