// import { Router } from 'express';
// import { PaymentController } from '@controllers/payment.controller';
// // import { WalletController } from '@controllers/wallet.controller';
// import { WebhookController } from '@controllers/webhook.controller';
// import { createPaymentRoutes } from './payment.route';
// import { createWalletRoutes } from './wallet.route';
// import { createWebhookRoutes } from './webhook.routes';
// // import { createHealthRoutes } from './health.routes';

// export function setupRoutes(
//   paymentController: PaymentController,
//   //   walletController: WalletController,
//   webhookController: WebhookController
// ): Router {
//   const router = Router();

//   router.use('/api/v1/payments', createPaymentRoutes(paymentController));
//   //   router.use('/api/v1/wallet', createWalletRoutes(walletController));
//   router.use('/webhooks', createWebhookRoutes(webhookController));
//   //   router.use('/health', createHealthRoutes());

//   return router;
// }

export { createPaymentRoutes } from './payment.route';
export { createWalletRoutes } from './wallet.route';
export { createWebhookRoutes } from './webhook.routes';
