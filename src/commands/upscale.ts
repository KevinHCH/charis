import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { VercelGeminiProvider } from '../providers/vercelGemini';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { readInputImages } from '../image/io';
import { parseNumber } from '../core/validation';

export function registerUpscale(program: Command) {
  program
    .command('upscale')
    .alias('up')
    .description('Increase the resolution of an image')
    .requiredOption('-i, --image <path>', 'Image path or URL')
    .option('-f, --factor <factor>', 'Upscale factor', '2')
    .option('-o, --out <dir>', 'Directory where the upscaled image will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const factor = parseNumber(options.factor, 2);
      const [buffer] = await readInputImages([options.image]);
      const provider = new VercelGeminiProvider();
      provider.setApiKey(apiKey);
      provider.setModel(cfg.model);

      if (!provider.upscale) {
        throw new Error('The current provider does not support upscaling yet.');
      }

      const upscaled = await provider.upscale({ image: buffer, factor });
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);
      await mkdir(outDir, { recursive: true });
      const path = `${outDir}/${makeFilename(1, cfg.format)}`;
      await writeFile(path, upscaled);
      console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
    });
}
