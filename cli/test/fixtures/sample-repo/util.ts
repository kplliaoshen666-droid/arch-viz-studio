export function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[sample] ${message}`);
}

export function repeat(s: string, n: number): string {
  let out = '';
  for (let i = 0; i < n; i += 1) out += s;
  return out;
}
