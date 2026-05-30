import { double, square } from './math';
import { log, repeat } from './util';

export function main(): void {
  const a = double(21);
  const b = square(7);
  log(repeat('=', 3));
  log(`double(21)=${a} square(7)=${b}`);
}

main();
