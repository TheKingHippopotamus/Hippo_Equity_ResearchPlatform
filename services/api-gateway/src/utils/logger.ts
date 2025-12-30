import winston from 'winston';

const consoleFormat = winston.format.printf((info) => {
  const { level, message, timestamp, ...meta } = info;
  const msg = typeof message === 'string' ? message : JSON.stringify(message);
  const metaKeys = Object.keys(meta).filter((key) => key !== 'service');
  const metaString = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp as string} ${level}: ${msg}${metaString}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        consoleFormat
      )
    })
  ]
});

// In production, also log to file
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

export default logger;
