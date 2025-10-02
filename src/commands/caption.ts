import { Command } from 'commander';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { readInputImages } from '../image/io';
import { VercelGeminiProvider } from '../providers/vercelGemini';

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

      const provider = new VercelGeminiProvider();
      provider.setApiKey(apiKey);
      provider.setModel(cfg.model);

      const caption = await provider.caption({ image: buffer });
      console.log(caption);
    });
}
