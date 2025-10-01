import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from '../config/config';
import { getApiKey } from '../config/keychain';
import { ensurePrompt } from '../core/validation';
import { improvePrompt } from '../core/prompts';

export function registerImprove(program: Command) {
  program
    .command('improve')
    .description('Improve a prompt before generating images')
    .requiredOption('--prompt <prompt>', 'Original prompt')
    .option('--style <style>', 'Optional style guidance to inject')
    .option('--save <file>', 'Write the improved prompt to a file')
    .action(async options => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const prompt = ensurePrompt(options.prompt);
      const improved = await improvePrompt(apiKey, cfg.model, prompt, options.style);
      if (options.save) {
        await writeFile(options.save, improved, 'utf8');
        console.log(`${chalk.green('✔')} saved ${chalk.cyan(options.save)}`);
      } else {
        console.log(improved);
      }
    });
}
