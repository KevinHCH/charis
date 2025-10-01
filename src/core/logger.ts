import pino from 'pino';

export const logger = pino({
  name: 'charis',
  level: process.env.CHARIS_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:standard',
      colorize: true,
    }
  } : undefined,
});
