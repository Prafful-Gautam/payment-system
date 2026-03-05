import { PaymentApplication } from './app';
import { logger } from './utils/logger';

const app = new PaymentApplication();
const port = parseInt(process.env.PORT || '3000');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  await app.shutdown();
  process.exit(0);
});

// Start application
app.start(port).catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
