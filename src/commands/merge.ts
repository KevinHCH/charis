import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { readInputImages } from '../image/io';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { parseNumber, parseSize } from '../core/validation';
import { writeHistory } from '../core/history';
import { createGeminiChain, tryProviders } from '../providers/chain';

export function registerMerge(program: Command) {
  program
    .command('merge')
    .alias('mg')
    .description('Merge images using Gemini image editing')
    .requiredOption('-i, --image <paths...>', 'Two or more image paths or URLs')
    .option('-l, --layout <layout>', 'Layout hint (blend|horizontal|grid)', 'blend')
    .option('-p, --prompt <prompt>', 'Custom prompt to send to Gemini')
    .option('-s, --size <widthxheight>', 'Target size for the merged image (WIDTHxHEIGHT)')
    .option('-f, --format <format>', 'Output format (png|jpg|webp)')
    .option('-q, --quality <quality>', 'Image quality between 0-100')
    .option('-o, --out <dir>', 'Directory where the merged image will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }
      const images = Array.isArray(options.image) ? options.image.flat() : [options.image];
      const bufs = await readInputImages(images);
      if (bufs.length < 2) {
        throw new Error('At least two images are required to merge.');
      }

      const layout = options.layout as string;
      const promptOverride = options.prompt as string | undefined;
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);
      const size = options.size ? parseSize(options.size) : undefined;
      const format = (options.format ?? cfg.format) as typeof cfg.format;
      const quality = parseNumber(options.quality, cfg.quality);

      const prompt = promptOverride ?? buildPrompt(layout, bufs.length);

      const providers = createGeminiChain(apiKey, { nativeModel: cfg.model, vercelModel: cfg.model });
      const { result: outputs } = await tryProviders(
        providers,
        p => p.edit({ images: bufs, instruction: prompt, size, format, quality }),
        output => Array.isArray(output) && output.length > 0,
        'image merge',
      );

      await mkdir(outDir, { recursive: true });
      const path = `${outDir}/${makeFilename(1, format)}`;
      await writeFile(path, outputs[0]);
      console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);

      await writeHistory({
        cmd: 'merge',
        prompt,
        images,
        files: [path],
        size,
        format,
        quality,
      });
    });
}

function buildPrompt(layout: string, count: number): string {
  const normalized = (layout ?? '').toLowerCase();
  const plural = count > 2 ? `${count} images` : 'both images';
  switch (normalized) {
    case 'horizontal':
      return `Combine ${plural} into a single panoramic image arranged side by side with clean seams, consistent lighting, and matching perspective.`;
    case 'grid':
      return `Create a cohesive collage that arranges ${plural} in a balanced grid layout with even spacing and unified color grading.`;
    default:
      return `Blend ${plural} into one cohesive scene with smooth transitions, consistent colors, and a photorealistic finish.`;
  }
}
