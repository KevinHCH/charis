import { runCLI } from './cli';
import { registerGenerate } from './commands/generate';
import { registerImprove } from './commands/improve';
import { registerEdit } from './commands/edit';
import { registerMerge } from './commands/merge';
import { registerCaption } from './commands/caption';
import { registerUpscale } from './commands/upscale';
import { registerRemoveBg } from './commands/removeBg';
import { registerMeme } from './commands/meme';
import { registerInspire } from './commands/inspire';
import { registerHistory } from './commands/history';
import { registerPresets } from './commands/presets';
import { registerConfig } from './commands/config';

export async function main(argv: string[]) {
  await runCLI([
    registerGenerate,
    registerImprove,
    registerEdit,
    registerMerge,
    registerCaption,
    registerUpscale,
    registerRemoveBg,
    registerMeme,
    registerInspire,
    registerHistory,
    registerPresets,
    registerConfig,
  ], argv);
}
