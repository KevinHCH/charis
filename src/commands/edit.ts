import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { parseNumber, parseSize } from '../core/validation';
import { readInputImages } from '../image/io';
import { writeHistory } from '../core/history';
import { createGeminiChain, tryProviders } from '../providers/chain';

export function registerEdit(program: Command) {
  program
    .command('edit')
    .alias('ed')
    .description('Edit a local or remote image with a prompt')
    .requiredOption('-i, --image <paths...>', 'One or more image paths or URLs')
    .requiredOption('-p, --prompt <prompt>', 'Prompt describing the desired edit')
    .option('-s, --size <widthxheight>', 'Target size in the format WIDTHxHEIGHT')
    .option('-f, --format <format>', 'Output format (png|jpg|webp)')
    .option('-q, --quality <quality>', 'Image quality between 0-100')
    .option('-o, --out <dir>', 'Directory where images will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const images: string[] = Array.isArray(options.image) ? options.image : [options.image];
      const prompt = options.prompt as string;
      const size = options.size ? parseSize(options.size) : undefined;
      const format = (options.format ?? cfg.format) as typeof cfg.format;
      const quality = parseNumber(options.quality, cfg.quality);
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);

      const buffers = await readInputImages(images);

      const providers = createGeminiChain(apiKey, { nativeModel: cfg.model, vercelModel: cfg.model });
      const { result: outputs } = await tryProviders(
        providers,
        p => p.edit({ images: buffers, instruction: prompt, size, format, quality }),
        output => Array.isArray(output) && output.length > 0,
        'image editing',
      );
      await mkdir(outDir, { recursive: true });
      const saved: string[] = [];
      let seq = 1;
      for (const buffer of outputs) {
        const path = `${outDir}/${makeFilename(seq++, format)}`;
        await writeFile(path, buffer);
        saved.push(path);
        console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
      }

      await writeHistory({ cmd: 'edit', prompt, images, files: saved, size, format, quality });
    });
}
