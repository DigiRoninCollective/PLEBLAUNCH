import app from './app';
import config from './config/config';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;
const server = createServer(app);

async function startServer() {
  try {
    // Initialize any services or connections here
    server.listen(PORT, () => {
      config.logger.info(`Server is running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      config.logger.info('Shutting down server...');
      server.close(() => {
        config.logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    config.logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
