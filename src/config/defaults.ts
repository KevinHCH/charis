import { AppConfig } from './config';

export const DEFAULT_CONFIG: AppConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  outputDir: './generated-images',
  format: 'png',
  quality: 95,
  defaultAspect: '16:9',
  timeoutMs: 60_000,
};
