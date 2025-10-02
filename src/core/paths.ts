import { join } from 'node:path';

export function defaultOutputDir(cwd: string, configured?: string): string {
  return configured ? configured : join(cwd, 'generated-images');
}

export function makeFilename(seq: number, ext: string, date = new Date()): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const ts = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `img-${seq}-${ts}.${ext}`;
}
