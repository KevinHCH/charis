import { Command } from 'commander';

export function registerMeme(program: Command) {
  program
    .command('meme')
    .description('Generate memes (placeholder)')
    .action(() => {
      console.log('Meme generation is not implemented yet.');
    });
}
