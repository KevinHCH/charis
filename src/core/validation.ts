import { z } from 'zod';

const sizeSchema = z.string().regex(/^(\d+)x(\d+)$/);

export function parseSize(size: string) {
  const parsed = sizeSchema.parse(size);
  const [, width, height] = /^(\d+)x(\d+)$/.exec(parsed)!;
  return { width: Number(width), height: Number(height) };
}

export function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return num;
}

export function ensurePrompt(prompt?: string): string {
  if (!prompt?.trim()) {
    throw new Error('A prompt is required (--prompt).');
  }
  return prompt;
}
