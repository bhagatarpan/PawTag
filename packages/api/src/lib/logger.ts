import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  ...(isDev && !isTest
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export default logger;
