import { Command, CommanderError } from 'commander';
import chalk from 'chalk';
import { logger } from './core/logger';

export type RegisterCommand = (program: Command) => void;

export async function runCLI(registrars: RegisterCommand[], argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('charis')
    .description('CLI for AI-powered image generation and editing with Gemini')
    .configureHelp({ helpWidth: Math.min(process.stdout.columns ?? 100, 120) })
    .showHelpAfterError(chalk.dim('\nRun "charis <command> --help" to learn more about a command.'))
    .showSuggestionAfterError(true)
    .enablePositionalOptions();

  program.addHelpCommand('help [command]', 'Display help for command');

  for (const register of registrars) {
    register(program);
  }

  program.exitOverride();

  program.configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str),
    outputError: (str, write) => {
      const formatted = str.replace(/^error:/i, chalk.bold('Error:'));
      write(chalk.red(formatted));
    },
  });

  try {
    await program.parseAsync(['node', 'charis', ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        process.exitCode = 0;
        return;
      }

      if (error.exitCode === 0) {
        process.exitCode = 0;
        return;
      }

      if (error.code === 'commander.unknownCommand') {
        logger.debug({ input: argv[0] }, 'Unknown command requested');
      }

      process.exitCode = error.exitCode ?? 1;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`${chalk.red('✖')} ${message}`);
    logger.debug({ err: error }, 'CLI command failed');
    process.exitCode = 1;
  }
}
