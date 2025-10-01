import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { readInputImages } from '../image/io';
import { mergeHorizontal, overlay } from '../image/sharpOps';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { loadConfig } from '../config/config';
import { parseNumber } from '../core/validation';

export function registerMerge(program: Command) {
  program
    .command('merge')
    .description('Merge two images with different layouts')
    .requiredOption('--image <paths...>', 'Two or more image paths or URLs', value => value.split(','))
    .option('--layout <layout>', 'Layout to use (horizontal|blend)', 'blend')
    .option('--opacity <value>', 'Opacity used when blending images', '0.5')
    .option('--out <dir>', 'Directory where the merged image will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const images = Array.isArray(options.image) ? options.image.flat() : [options.image];
      const bufs = await readInputImages(images);
      if (bufs.length < 2) {
        throw new Error('At least two images are required to merge.');
      }

      const layout = options.layout as string;
      const opacity = parseNumber(options.opacity, 0.5);
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);

      let output: Buffer;
      if (layout === 'horizontal') {
        output = await mergeHorizontal(bufs[0], bufs[1]);
      } else {
        output = await overlay(bufs[0], bufs[1], opacity);
      }

      await mkdir(outDir, { recursive: true });
      const path = `${outDir}/${makeFilename(1, cfg.format)}`;
      await writeFile(path, output);
      console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
    });
}
