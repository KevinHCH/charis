import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { ensurePrompt, parseNumber, parseSize } from '../core/validation';
import { VercelGeminiProvider } from '../providers/vercelGemini';
import { writeHistory } from '../core/history';
import { logger } from '../core/logger';

export function registerGenerate(program: Command) {
  program
    .command('generate')
    .description('Generate images from a prompt')
    .requiredOption('-p, --prompt <prompt>', 'Prompt to send to Gemini')
    .option('-n, --count <count>', 'Number of images to generate (default: 1)', '1')
    .option('--size <widthxheight>', 'Target size in the format WIDTHxHEIGHT')
    .option('--format <format>', 'Output format (png|jpg|webp)')
    .option('--quality <quality>', 'Image quality between 0-100')
    .option('--out <dir>', 'Directory where images will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const prompt = ensurePrompt(options.prompt);
      const n = parseNumber(options.count, 1);
      const size = options.size ? parseSize(options.size) : undefined;
      const format = (options.format ?? cfg.format) as typeof cfg.format;
      const quality = parseNumber(options.quality, cfg.quality);
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);

      const provider = new VercelGeminiProvider();
      provider.setApiKey(apiKey);
      provider.setModel(cfg.model);

      logger.info({ prompt, n, size, format, quality }, 'Generating images with Gemini');
      const buffers = await provider.generate({ prompt, n, size, format, quality });

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
