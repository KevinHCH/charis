import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { logger } from '../core/logger';
import { getConfigDir } from './config';

type KeytarModule = typeof import('keytar');

const SERVICE = 'charis';

function getKeystorePath(): string {
  return join(getConfigDir(), 'keys.json');
}

let keytarPromise: Promise<KeytarModule | null> | null = null;

async function loadKeytar(): Promise<KeytarModule | null> {
  if (process.env.CHARIS_DISABLE_KEYTAR === '1') {
    logger.debug('Keytar disabled via environment override');
    return null;
  }

  if (!keytarPromise) {
    keytarPromise = import('keytar')
      .then((mod) => mod.default ?? mod)
      .catch((error) => {
        logger.debug({ err: error }, 'Keytar unavailable, falling back to file keystore');
        return null;
      });
  }

  return keytarPromise ? await keytarPromise : null;
}

async function readFallbackKeystore(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(getKeystorePath(), 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.debug({ err: error }, 'Failed to read fallback keystore');
    }
    return {};
  }
}

async function writeFallbackKeystore(data: Record<string, string>): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getKeystorePath(), JSON.stringify(data, null, 2), 'utf8');
}

export async function getApiKey(name = 'GEMINI_API_KEY'): Promise<string> {
  const envValue = process.env[name];
  if (envValue) {
    return envValue;
  }

  const keytar = await loadKeytar();
  if (keytar) {
    try {
      const stored = await keytar.getPassword(SERVICE, name);
      if (stored) {
        return stored;
      }
    } catch (error) {
      logger.debug({ err: error }, 'Keytar getPassword failed, falling back to file keystore');
    }
  }

  const fallback = await readFallbackKeystore();
  return fallback[name] ?? '';
}

export async function setApiKey(value: string, name = 'GEMINI_API_KEY'): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, name, value);
      return;
    } catch (error) {
      logger.debug({ err: error }, 'Keytar setPassword failed, persisting to file keystore');
    }
  }

  const fallback = await readFallbackKeystore();
  fallback[name] = value;
  await writeFallbackKeystore(fallback);
}
