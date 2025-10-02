import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { DEFAULT_CONFIG } from '../src/config/defaults';
import { configPath, getConfigDir, loadConfig, saveConfig } from '../src/config/config';

const ORIGINAL_ENV = {
  CHARIS_CONFIG_DIR: process.env.CHARIS_CONFIG_DIR,
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
};

function restoreEnv() {
  if (ORIGINAL_ENV.CHARIS_CONFIG_DIR === undefined) {
    delete process.env.CHARIS_CONFIG_DIR;
  } else {
    process.env.CHARIS_CONFIG_DIR = ORIGINAL_ENV.CHARIS_CONFIG_DIR;
  }

  if (ORIGINAL_ENV.HOME === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = ORIGINAL_ENV.HOME;
  }

  if (ORIGINAL_ENV.USERPROFILE === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = ORIGINAL_ENV.USERPROFILE;
  }
}

describe('configuration paths', () => {
  afterEach(() => {
    restoreEnv();
  });

  test('prefers CHARIS_CONFIG_DIR override when provided', async () => {
    const override = await mkdtemp(join(tmpdir(), 'charis-test-config-'));
    process.env.CHARIS_CONFIG_DIR = override;

    const path = configPath();
    expect(path).toBe(join(override, 'config.json'));

    const config = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);

    const updated = { ...config, quality: 80 };
    await saveConfig(updated);

    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw)).toEqual(updated);
  });

  test('falls back to POSIX home directories (Linux-like)', () => {
    delete process.env.CHARIS_CONFIG_DIR;
    process.env.HOME = '/home/charis-user';
    delete process.env.USERPROFILE;

    expect(getConfigDir()).toBe('/home/charis-user/.charis');
    expect(configPath()).toBe('/home/charis-user/.charis/config.json');
  });

  test('falls back to POSIX home directories (macOS-like)', () => {
    delete process.env.CHARIS_CONFIG_DIR;
    process.env.HOME = '/Users/charis';
    delete process.env.USERPROFILE;

    expect(getConfigDir()).toBe('/Users/charis/.charis');
    expect(configPath()).toBe('/Users/charis/.charis/config.json');
  });
});
