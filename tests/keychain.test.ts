import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getApiKey, setApiKey } from '../src/config/keychain';

const ORIGINAL_ENV = { ...process.env } as Record<string, string | undefined>;

afterEach(async () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('keychain fallbacks', () => {
  test('prefers environment variable when provided', async () => {
    process.env.CHARIS_DISABLE_KEYTAR = '1';
    process.env.GEMINI_API_KEY = 'env-value';

    const key = await getApiKey();
    expect(key).toBe('env-value');
  });

  test('persists to the config keystore when keytar is unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'charis-keys-'));
    process.env.CHARIS_CONFIG_DIR = dir;
    process.env.CHARIS_DISABLE_KEYTAR = '1';
    delete process.env.GEMINI_API_KEY;

    try {
      await setApiKey('file-value');

      const key = await getApiKey();
      expect(key).toBe('file-value');

      const raw = await readFile(join(dir, 'keys.json'), 'utf8');
      expect(JSON.parse(raw).GEMINI_API_KEY).toBe('file-value');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
