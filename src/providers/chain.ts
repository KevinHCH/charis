import type { ImageProvider } from './provider';
import { GeminiNativeProvider } from './geminiNative';
import { VercelGeminiProvider } from './vercelGemini';
import { logger } from '../core/logger';

interface ProviderModels {
  nativeModel: string;
  vercelModel: string;
}

export function createGeminiChain(apiKey: string, models: ProviderModels): ImageProvider[] {
  const native = new GeminiNativeProvider();
  native.setApiKey(apiKey);
  native.setModel(models.nativeModel);

  const vercel = new VercelGeminiProvider();
  vercel.setApiKey(apiKey);
  vercel.setModel(models.vercelModel);

  return [native, vercel];
}

export async function tryProviders<T>(
  providers: ImageProvider[],
  executor: (provider: ImageProvider) => Promise<T>,
  validate: (result: T) => boolean,
  context: string,
): Promise<{ result: T; provider: ImageProvider }> {
  let lastError: unknown = new Error(`No providers were able to complete ${context}.`);
  for (const [index, provider] of providers.entries()) {
    try {
      const result = await executor(provider);
      if (validate(result)) {
        if (index > 0) {
          logger.warn({ provider: provider.name }, `Fell back to ${provider.name} for ${context}.`);
        }
        return { result, provider };
      }
      const message = `${provider.name} returned an empty result for ${context}.`;
      logger.warn({ provider: provider.name }, message);
      lastError = new Error(message);
    } catch (error) {
      logger.warn({ provider: provider.name, err: error }, `${provider.name} failed for ${context}.`);
      lastError = error;
    }
  }
  throw lastError;
}
