import { Command } from 'commander';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { readInputImages } from '../image/io';
import { basename } from 'node:path';
import { GEMINI_DEFAULT_TEXT_MODEL } from '../constants';
import { createGeminiChain, tryProviders } from '../providers/chain';

export function registerCaption(program: Command) {
  program
    .command('caption')
    .alias('cap')
    .description('Generate a caption or reverse prompt for an image')
    .requiredOption('-i, --image <path>', 'Image path or URL')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }
      const [buffer] = await readInputImages([options.image]);

      const providers = createGeminiChain(apiKey, {
        nativeModel: GEMINI_DEFAULT_TEXT_MODEL,
        vercelModel: GEMINI_DEFAULT_TEXT_MODEL,
      });

      const { result: caption } = await tryProviders(
        providers,
        p => p.caption({ image: buffer }),
        text => typeof text === 'string' && text.trim().length > 0,
        'image captioning',
      );
      const formatted = formatCaption(caption);
      const label = deriveLabel(options.image);
      console.log(`${label}: ${formatted}`);
    });
}

function formatCaption(raw: string): string {
  const stripped = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`+/g, '')
    .trim();

  const sentenceMatch = stripped.match(/([A-Za-z][^.!?]{5,400}[.!?])/);
  if (sentenceMatch) {
    const candidate = cleanupCaption(sentenceMatch[1]);
    if (candidate) {
      return candidate;
    }
  }

  const lines = stripped
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const alpha = (line.match(/[A-Za-z]/g) ?? []).length;
    if (alpha >= 4) {
      const candidate = cleanupCaption(line);
      if (candidate) {
        return candidate;
      }
    }
  }

  const compact = cleanupCaption(stripped);
  return compact.length ? compact : raw.trim();
}

function deriveLabel(input: string): string {
  try {
    const url = new URL(input);
    const name = basename(url.pathname);
    return name ? name : input;
  } catch (error) {
    const name = basename(input);
    return name ? name : input;
  }
}

function cleanupCaption(text: string): string {
  return text
    .replace(/^caption[:\-]\s*/i, '')
    .replace(/[{}\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^"|"$/g, '')
    .trim();
}
