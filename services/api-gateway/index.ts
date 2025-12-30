import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import type { ClientRequest } from 'http';
import axios from 'axios';
import logger from './src/utils/logger.js';
import errorHandler from './src/middleware/errorHandler.js';
import requestLogger from './src/middleware/requestLogger.js';
import errorLoggingService from './src/services/errorLoggingService.js';
import postgresClient from './src/config/postgres.js';
import { enforceHTTPS, validateAPIKey, sessionMiddleware } from './src/middleware/security.js';
import validators from './src/middleware/validators.js';
import { setupSwaggerRoutes } from './src/routes/swagger.js';

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Trust proxy for accurate client IPs when behind Apache/NGINX.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Cookie parser for session management
app.use(cookieParser());

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use(enforceHTTPS);
}

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitize request body to prevent injection attacks
app.use(validators.sanitizeRequestBody);

// Session management
app.use(sessionMiddleware);

// Request logging middleware
app.use(requestLogger);

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Rate limiting middleware (additional layer beyond Apache)
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || (isDev ? '1000' : '100'), 10);
const rateLimitSkipLocalhost = process.env.RATE_LIMIT_SKIP_LOCALHOST !== 'false';
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    if (!isDev || !rateLimitSkipLocalhost) {
      return false;
    }
    const ip = req.ip;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Apply API key validation to protected routes (if API_KEY is set)
if (process.env.API_KEY) {
  app.use('/api/protected', validateAPIKey);
}

// Setup Swagger routes
setupSwaggerRoutes(app);

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy' as string,
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '1.0.0',
      dependencies: {} as Record<string, any>
    };

    // Check downstream services
    const services = [
      { name: 'data-service', url: `http://data-service:${process.env.DATA_SERVICE_PORT || '3001'}/health` },
      { name: 'report-service', url: `http://report-service:${process.env.REPORT_SERVICE_PORT || '3003'}/health` },
      { name: 'translation-service', url: `http://translation-service:${process.env.TRANSLATION_SERVICE_PORT || '3004'}/health` },
      { name: 'user-service', url: `http://user-service:${process.env.USER_SERVICE_PORT || '3005'}/health` }
    ];

    // Check each service (with timeout)
    const serviceChecks = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const response = await axios.get(service.url, {
            timeout: 2000, // 2 second timeout
            headers: { 'Accept': 'application/json' },
            validateStatus: () => true // Don't throw on any status
          });
          
          if (response.status >= 200 && response.status < 300) {
            return { name: service.name, status: 'healthy', details: response.data };
          } else {
            return { name: service.name, status: 'unhealthy', error: `HTTP ${response.status}` };
          }
        } catch (error) {
          return { 
            name: service.name, 
            status: 'unhealthy', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      })
    );

    // Process results
    serviceChecks.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        healthStatus.dependencies[result.value.name] = result.value;
        if (result.value.status === 'unhealthy') {
          healthStatus.status = 'degraded';
        }
      } else {
        healthStatus.dependencies[services[index].name] = {
          status: 'unhealthy',
          error: result.reason?.message || 'Unknown error'
        };
        healthStatus.status = 'degraded';
      }
    });

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Health check failed: ${errorMessage}`);
    res.status(503).json({
      status: 'unhealthy',
    timestamp: new Date().toISOString(),
      service: 'api-gateway',
      error: errorMessage
  });
  }
});

// Service proxy configurations
interface ServiceConfig {
  target: string;
  changeOrigin: boolean;
  pathRewrite: Record<string, string>;
  onError: (err: Error, req: Request, res: Response) => void;
  onProxyReq?: (proxyReq: ClientRequest, req: Request, res: Response) => void;
}

const proxyRequestBody = (proxyReq: ClientRequest, req: Request): void => {
  const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!methodsWithBody.includes(req.method)) {
    return;
  }

  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

const services: Record<string, ServiceConfig> = {
  '/api/data': {
    target: `http://data-service:${process.env.DATA_SERVICE_PORT || '3001'}`,
    changeOrigin: true,
    pathRewrite: {
      '^/api/data': ''
    },
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`Data service proxy error: ${err.message}`);
      errorHandler.handleServiceError(res, 'data-service', err, req);
    },
    onProxyReq: proxyRequestBody
  },
  '/api/report': {
    target: `http://report-service:${process.env.REPORT_SERVICE_PORT || '3003'}`,
    changeOrigin: true,
    pathRewrite: {
      '^/api/report': ''
    },
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`Report service proxy error: ${err.message}`);
      errorHandler.handleServiceError(res, 'report-service', err, req);
    },
    onProxyReq: proxyRequestBody
  },
  '/api/translation': {
    target: `http://translation-service:${process.env.TRANSLATION_SERVICE_PORT || '3004'}`,
    changeOrigin: true,
    pathRewrite: {
      '^/api/translation': ''
    },
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`Translation service proxy error: ${err.message}`);
      errorHandler.handleServiceError(res, 'translation-service', err, req);
    },
    onProxyReq: proxyRequestBody
  },
  '/api/user': {
    target: `http://user-service:${process.env.USER_SERVICE_PORT || '3005'}`,
    changeOrigin: true,
    pathRewrite: {
      '^/api/user': ''
    },
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`User service proxy error: ${err.message}`);
      errorHandler.handleServiceError(res, 'user-service', err, req);
    },
    onProxyReq: proxyRequestBody
  }
};

// Set up proxy middleware for each service
Object.keys(services).forEach(path => {
  app.use(path, createProxyMiddleware(services[path] as Options));
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Hippo Equity Research API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      data: '/api/data',
      report: '/api/report',
      translation: '/api/translation',
      user: '/api/user'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler.handleError(err as Error & { statusCode?: number; status?: number }, req, res, next);
  // Note: handleError is synchronous, but logs asynchronously
});

// Initialize error logging service and start server
async function startServer() {
  try {
    // Initialize PostgreSQL connection for error logging
    await postgresClient.connect();
    await errorLoggingService.initialize();
    logger.info('Error logging service initialized');

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`API Gateway server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start server: ${errorMessage}`);
    // Continue without error logging if PostgreSQL is unavailable
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`API Gateway server running on port ${PORT} (without error logging)`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await postgresClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await postgresClient.disconnect();
  process.exit(0);
});

export default app;
