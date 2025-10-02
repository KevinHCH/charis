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
    .alias('imp')
    .description('Improve a prompt before generating images')
    .argument('[prompt...]', 'Original prompt to enhance')
    .option('-p, --prompt <prompt>', 'Original prompt')
    .option('-s, --style <style>', 'Optional style guidance to inject')
    .option('-o, --save <file>', 'Write the improved prompt to a file')
    .action(async (promptWords: string[], options) => {
      const cfg = await loadConfig();
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Run "charis config set-key GEMINI <API_KEY>".');
      }

      const promptFromArgs = promptWords.join(' ').trim();
      const prompt = ensurePrompt(options.prompt ?? promptFromArgs);
      const improved = await improvePrompt(apiKey, cfg.model, prompt, options.style);
      if (options.save) {
        await writeFile(options.save, improved, 'utf8');
        console.log(`${chalk.green('✔')} saved ${chalk.cyan(options.save)}`);
      } else {
        console.log(improved);
      }
    });
}
