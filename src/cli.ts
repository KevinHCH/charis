import { Command, CommanderError } from 'commander';
import chalk from 'chalk';
import { logger } from './core/logger';

export type RegisterCommand = (program: Command) => void;

export async function runCLI(registrars: RegisterCommand[], argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('charis')
    .description('CLI for AI-powered image generation and editing with Gemini');

  for (const register of registrars) {
    register(program);
  }

  program.configureOutput({
    outputError: (str, write) => {
      write(chalk.red(str));
    }
  });

  try {
    await program.parseAsync(['charis', ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return;
      }

      if (error.exitCode === 0) {
        return;
      }
    }

    logger.error({ err: error }, 'CLI command failed');
    throw error;
  }
}
