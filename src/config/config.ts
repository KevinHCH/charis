import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from './defaults';

export type AppConfig = {
  provider: 'gemini';
  model: string;
  outputDir: string;
  format: 'png' | 'jpg' | 'webp';
  quality: number;
  defaultAspect: string;
  timeoutMs: number;
};

function resolveHomeDirectory(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

export function getConfigDir(): string {
  if (process.env.CHARIS_CONFIG_DIR && process.env.CHARIS_CONFIG_DIR.trim() !== '') {
    return resolve(process.env.CHARIS_CONFIG_DIR);
  }
  return join(resolveHomeDirectory(), '.charis');
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const path = getConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2), 'utf8');
}

export function configPath(): string {
  return getConfigPath();
}
