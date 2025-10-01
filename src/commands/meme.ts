import { Command } from 'commander';

export function registerMeme(program: Command) {
  program
    .command('meme')
    .alias('mem')
    .description('Generate memes (placeholder)')
    .action(() => {
      console.log('Meme generation is not implemented yet.');
    });
}
