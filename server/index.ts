import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import cron from 'node-cron';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { closeDatabasePool } from './db';
import { performBackup } from './backup';

const app = express();
// Increase body size limits to allow PDF attachments in email payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: false, limit: '25mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

// Global error handlers will be set up after server initialization

(async () => {
  const server = await registerRoutes(app);

  // Global error handler for API routes - must be before Vite
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      return res.status(status).json({ error: message });
    }
    next(err);
  });

  // API 404 handler - must be before Vite to catch unmatched API routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
      });
    }
    next();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(
    {
      port,
      host: '0.0.0.0',
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n📡 ${signal} received, starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Close database pool
    await closeDatabasePool();

    // Force exit after a timeout if graceful shutdown takes too long
    setTimeout(() => {
      console.error('⚠️ Forcing exit after timeout');
      process.exit(1);
    }, 10000);

    process.exit(0);
  };

  // Setup database backup cron job (runs daily at 4 AM IST)
  // Cron expression: '0 4 * * *' means 4:00 AM every day
  // Timezone: 'Asia/Kolkata' (IST - Indian Standard Time)
  const backupCron = cron.schedule('0 4 * * *', async () => {
    console.log('⏰ Scheduled backup triggered at 4 AM IST');
    try {
      await performBackup();
    } catch (error: any) {
      console.error('❌ Scheduled backup failed:', error.message);
      // Don't throw - allow the app to continue running
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });

  console.log('✅ Database backup cron job scheduled: Daily at 4:00 AM IST');
  console.log('   Backup files will be stored in: ./backups/');
  console.log('   Old backups (older than 30 days) will be automatically cleaned up');

  // Handle termination signals
  process.on('SIGTERM', () => {
    backupCron.stop();
    gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    backupCron.stop();
    gracefulShutdown('SIGINT');
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    backupCron.stop();
    await closeDatabasePool();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    backupCron.stop();
    await closeDatabasePool();
    process.exit(1);
  });
})();
