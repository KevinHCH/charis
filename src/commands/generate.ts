import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { ensurePrompt, parseNumber, parseSize } from '../core/validation';
import { writeHistory } from '../core/history';
import { logger } from '../core/logger';
import { createGeminiChain, tryProviders } from '../providers/chain';

export function registerGenerate(program: Command) {
  program
    .command('generate')
    .aliases(['gen', 'g'])
    .description('Generate images from a prompt')
    .argument('[prompt...]', 'Prompt to send to Gemini')
    .option('-p, --prompt <prompt>', 'Prompt to send to Gemini')
    .option('-n, --count <count>', 'Number of images to generate (default: 1)', '1')
    .option('--size <widthxheight>', 'Target size in the format WIDTHxHEIGHT')
    .option('--format <format>', 'Output format (png|jpg|webp)')
    .option('--quality <quality>', 'Image quality between 0-100')
    .option('--out <dir>', 'Directory where images will be written')
    .action(async (
      promptWords: string[],
      options: {
        prompt?: string;
        count?: string;
        size?: string;
        format?: string;
        quality?: string;
        out?: string;
      },
      command: Command,
    ) => {
      if (promptWords.length === 1 && promptWords[0].toLowerCase() === 'help') {
        command.help({ error: false });
        return;
      }

      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const promptFromArgs = promptWords.join(' ').trim();
      const prompt = ensurePrompt(options.prompt ?? promptFromArgs);
      const n = parseNumber(options.count, 1);
      const size = options.size ? parseSize(options.size) : undefined;
      const format = (options.format ?? cfg.format) as typeof cfg.format;
      const quality = parseNumber(options.quality, cfg.quality);
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);

      logger.info({ prompt, n, size, format, quality }, 'Generating images with Gemini');
      const providers = createGeminiChain(apiKey, { nativeModel: cfg.model, vercelModel: cfg.model });
      const { result: buffers } = await tryProviders(
        providers,
        p => p.generate({ prompt, n, size, format, quality }),
        output => Array.isArray(output) && output.length > 0,
        'image generation',
      );

      await mkdir(outDir, { recursive: true });
      const saved: string[] = [];
      let seq = 1;
      for (const buffer of buffers) {
        const filename = makeFilename(seq++, format);
        const path = `${outDir}/${filename}`;
        await writeFile(path, buffer);
        saved.push(path);
        console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
      }

      await writeHistory({ cmd: 'generate', prompt, n, size, format, quality, outDir, files: saved });
    });
}
