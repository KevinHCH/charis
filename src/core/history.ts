import { homedir } from 'node:os';
import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';

const HISTORY_DIR = join(homedir(), '.charis');
const HISTORY_FILE = join(HISTORY_DIR, 'history.jsonl');

export async function writeHistory(event: Record<string, unknown>): Promise<void> {
  await mkdir(HISTORY_DIR, { recursive: true });
  const payload = JSON.stringify({ ts: new Date().toISOString(), ...event });
  await appendFile(HISTORY_FILE, `${payload}\n`, 'utf8');
}

export function historyPath(): string {
  return HISTORY_FILE;
}
