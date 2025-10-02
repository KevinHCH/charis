import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { VercelGeminiProvider } from '../providers/vercelGemini';
import { defaultOutputDir, makeFilename } from '../core/paths';
import { readInputImages } from '../image/io';

export function registerRemoveBg(program: Command) {
  program
    .command('remove-bg')
    .alias('rb')
    .description('Remove the background from an image')
    .requiredOption('-i, --image <path>', 'Image path or URL')
    .option('-o, --out <dir>', 'Directory where the processed image will be written')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const [buffer] = await readInputImages([options.image]);
      const provider = new VercelGeminiProvider();
      provider.setApiKey(apiKey);
      provider.setModel(cfg.model);

      if (!provider.removeBackground) {
        throw new Error('The current provider does not support background removal yet.');
      }

      const result = await provider.removeBackground({ image: buffer });
      const outDir = options.out ?? defaultOutputDir(process.cwd(), cfg.outputDir);
      await mkdir(outDir, { recursive: true });
      const path = `${outDir}/${makeFilename(1, cfg.format)}`;
      await writeFile(path, result);
      console.log(`${chalk.green('✔')} saved ${chalk.cyan(path)}`);
    });
}
