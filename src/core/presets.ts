import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';

export type Preset = Record<string, unknown>;

export async function loadPreset(path: string): Promise<Preset> {
  const absolute = resolve(path);
  const raw = await readFile(absolute, 'utf8');
  return YAML.parse(raw) as Preset;
}
