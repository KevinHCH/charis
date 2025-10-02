import { Command } from 'commander';

export function registerInspire(program: Command) {
  program
    .command('inspire')
    .alias('insp')
    .description('Show inspirational prompts (placeholder)')
    .action(() => {
      console.log('The inspire command is not implemented yet.');
    });
}
