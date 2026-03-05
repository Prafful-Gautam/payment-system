import 'reflect-metadata';

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { createPaymentRoutes, createWalletRoutes, createWebhookRoutes } from './routes';
import { errorHandler, requestLogger } from './middleware';
import { PaymentController, WebhookController } from './controllers';
import { PaymentService } from './services/payment.service';
import { WalletService } from './services/wallet.service';
import { AuditService } from './services/audit.service';
import { GatewayFactory } from './services/gateway-factory.service';
import { logger } from './utils/logger';
import { Wallet, WalletTransaction, PaymentTransaction, AuditLog } from '@entities/index';
import { PaymentRepository } from '@repositories/payment.repository';

export class PaymentApplication {
  private app: Application;
  private dataSource: DataSource;

  constructor() {
    this.app = express();
    this.dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'payment_system',
      entities: ['src/entities/**/*.entity.ts'],
      synchronize: false, // Use migrations in production
      logging: process.env.NODE_ENV === 'development',
    });
  }

  async initialize(): Promise<void> {
    // Initialize database connection
    await this.dataSource.initialize();
    logger.info('Database connected successfully');

    // Setup middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Setup error handling
    this.app.use(errorHandler);
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);

    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy', timestamp: new Date() });
    });
  }

  private setupRoutes(): void {
    // make data source available to repositories using global helper
    (global as any).dataSource = this.dataSource;

    // Initialize services
    const walletService = new WalletService(
      this.dataSource.getRepository(Wallet),
      this.dataSource.getRepository(WalletTransaction)
    );

    const gatewayFactory = new GatewayFactory();

    const paymentRepo = new PaymentRepository();
    const paymentService = new PaymentService(
      walletService,
      gatewayFactory,
      paymentRepo,
      this.dataSource.manager
    );

    const auditService = new AuditService(this.dataSource.getRepository(AuditLog));

    // Initialize controllers
    const paymentController = new PaymentController(paymentService, walletService);

    const webhookController = new WebhookController(paymentService, auditService, gatewayFactory);

    // Setup routes
    this.app.use('/api/v1/payments', createPaymentRoutes(paymentController));
    this.app.use('/api/v1/wallet', createWalletRoutes(paymentController));
    this.app.use('/webhooks', createWebhookRoutes(webhookController));
  }

  async start(port: number = 3000): Promise<void> {
    await this.initialize();

    this.app.listen(port, () => {
      logger.info(`Payment service running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down payment service...');
    await this.dataSource.destroy();
    logger.info('Database connection closed');
  }
}
