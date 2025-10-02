import { AppConfig } from './config';
import { GEMINI_DEFAULT_IMAGE_MODEL } from '../constants';

export const DEFAULT_CONFIG: AppConfig = {
  provider: 'gemini',
  model: GEMINI_DEFAULT_IMAGE_MODEL,
  outputDir: './generated-images',
  format: 'png',
  quality: 95,
  defaultAspect: '16:9',
  timeoutMs: 60_000,
};
