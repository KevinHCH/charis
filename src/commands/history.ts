import { Command } from 'commander';
import { createReadStream, constants, accessSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { historyPath } from '../core/history';

export function registerHistory(program: Command) {
  program
    .command('history')
    .alias('hist')
    .description('Print the execution history')
    .action(async () => {
      const path = historyPath();
      try {
        accessSync(path, constants.F_OK);
      } catch {
        console.log('No history available yet.');
        return;
      }
      const stream = createReadStream(path, { encoding: 'utf8' });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      let idx = 0;
      for await (const line of rl) {
        console.log(`#${++idx} ${line}`);
      }
      if (idx === 0) {
        console.log('No history available yet.');
      }
    });
}
