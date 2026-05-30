// Types for the JS build helper so TS consumers (the prompt-driven contract test) get a typed
// import of `buildCli` instead of an implicit `any`.
export function buildCli(options?: { quiet?: boolean }): Promise<string>;
