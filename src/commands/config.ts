import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/config';
import { setApiKey } from '../config/keychain';

export function registerConfig(program: Command) {
  const cmd = program.command('config').description('Manage Charis configuration');

  cmd
    .command('init')
    .description('Create a configuration file with default values')
    .action(async () => {
      const cfg = await loadConfig();
      await saveConfig(cfg);
      console.log(`${chalk.green('✔')} wrote default configuration to disk.`);
    });

  cmd
    .command('set-key')
    .description('Store an API key in the system keychain')
    .argument('<name>', 'Key label (e.g. GEMINI)')
    .argument('<value>', 'API key value')
    .action(async (name: string, value: string) => {
      const keyName = name.toUpperCase() === 'GEMINI' ? 'GEMINI_API_KEY' : name;
      await setApiKey(value, keyName);
      console.log(`${chalk.green('✔')} stored API key for ${keyName}`);
    });

  cmd
    .command('set')
    .description('Update a configuration field')
    .argument('<field>', 'Field to update')
    .argument('<value>', 'New value')
    .action(async (field: string, value: string) => {
      const cfg = await loadConfig();
      (cfg as any)[field] = coerceValue(value);
      await saveConfig(cfg);
      console.log(`${chalk.green('✔')} updated ${field}.`);
    });

  cmd
    .command('show')
    .description('Print the current configuration')
    .action(async () => {
      const cfg = await loadConfig();
      console.log(JSON.stringify(cfg, null, 2));
    });
}

function coerceValue(value: string): unknown {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  const num = Number(value);
  if (!Number.isNaN(num)) {
    return num;
  }
  return value;
}
