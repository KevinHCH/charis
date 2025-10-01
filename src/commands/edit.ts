import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { parseNumber, parseSize } from '../core/validation';
import { readInputImages } from '../image/io';
import { VercelGeminiProvider } from '../providers/vercelGemini';
import { writeHistory } from '../core/history';

export function registerEdit(program: Command) {
  program
    .command('edit')
    .description('Edit a local or remote image with an instruction')
    .requiredOption('--image <paths...>', 'One or more image paths or URLs')
    .requiredOption('--instruction <instruction>', 'Editing instruction to apply')
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

      const images: string[] = Array.isArray(options.image) ? options.image : [options.image];
      const instruction = options.instruction as string;
      const size = options.size ? parseSize(options.size) : undefined;
      const format = (options.format ?? cfg.format) as typeof cfg.format;
      const quality = parseNumber(options.quality, cfg.quality);
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);

      const buffers = await readInputImages(images);

      const provider = new VercelGeminiProvider();
      provider.setApiKey(apiKey);
      provider.setModel(cfg.model);

      const outputs = await provider.edit({ images: buffers, instruction, size, format, quality });
      await mkdir(outDir, { recursive: true });
      const saved: string[] = [];
      let seq = 1;
      for (const buffer of outputs) {
        const path = `${outDir}/${makeFilename(seq++, format)}`;
        await writeFile(path, buffer);
        saved.push(path);
        console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
      }

      await writeHistory({ cmd: 'edit', instruction, images, files: saved, size, format, quality });
    });
}
