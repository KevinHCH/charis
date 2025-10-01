import { Command } from 'commander';
import chalk from 'chalk';
import { loadPreset } from '../core/presets';

export function registerPresets(program: Command) {
  program
    .command('presets')
    .description('Inspect prompt presets from YAML files')
    .argument('<path>', 'Path to the preset YAML file')
    .action(async (path: string) => {
      const preset = await loadPreset(path);
      console.log(chalk.cyan(JSON.stringify(preset, null, 2)));
    });
}
