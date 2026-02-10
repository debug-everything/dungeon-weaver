import pino from 'pino';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const LOG_DIR = resolve('logs');
mkdirSync(LOG_DIR, { recursive: true });

const logFile = resolve(LOG_DIR, 'server.log');

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      // Pretty-print to console
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        },
        level: process.env.LOG_LEVEL || 'info'
      },
      // JSON to file (for grep/tail)
      {
        target: 'pino/file',
        options: { destination: logFile, mkdir: true },
        level: process.env.LOG_LEVEL || 'info'
      }
    ]
  }
});

// Named child loggers for subsystems
export const llmLogger = logger.child({ module: 'llm' });
export const dbLogger = logger.child({ module: 'db' });
export const apiLogger = logger.child({ module: 'api' });
