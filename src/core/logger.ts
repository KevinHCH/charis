import chalk from 'chalk';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

const ignoredKeys = new Set(['level', 'time', 'pid', 'hostname', 'name']);

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatMeta(log: Record<string, unknown>, messageKey: string): string {
  const extras: string[] = [];
  for (const [key, value] of Object.entries(log)) {
    if (ignoredKeys.has(key) || key === messageKey || key === 'err' || key === 'error') {
      continue;
    }
    extras.push(`${chalk.dim(key)}=${chalk.dim(formatValue(value))}`);
  }
  if (extras.length === 0) {
    return '';
  }
  return ' ' + extras.join(' ');
}

function formatError(err: unknown): string {
  if (!err) {
    return '';
  }
  if (typeof err === 'object' && err !== null && 'stack' in err && typeof err.stack === 'string') {
    return `\n${chalk.dim(err.stack)}`;
  }
  if (typeof err === 'object') {
    try {
      return `\n${chalk.dim(JSON.stringify(err, null, 2))}`;
    } catch {
      return `\n${chalk.dim(String(err))}`;
    }
  }
  return `\n${chalk.dim(String(err))}`;
}

const prettyStream = pinoPretty({
  colorize: false,
  translateTime: 'SYS:standard',
  singleLine: true,
  messageFormat(log, messageKey) {
    const message = log[messageKey] ?? '';
    const meta = formatMeta(log, messageKey);
    const errorBlock = formatError(log.err ?? log.error);
    return `${message}${meta}${errorBlock}`.trimEnd();
  },
});

export const logger = pino(
  {
    name: 'charis',
    level: process.env.CHARIS_LOG_LEVEL || 'info',
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  prettyStream,
);
