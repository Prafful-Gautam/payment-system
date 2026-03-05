import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rate-limiter.middleware';

export function createPaymentRoutes(paymentController: PaymentController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Apply rate limiting
  router.use(
    rateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute
    })
  );

  router.post('/initiate', (req, res) => paymentController.initiatePayment(req, res));

  router.post('/process', (req, res) => paymentController.processPayment(req, res));

  router.get('/transaction/:transaction_id', (req, res) =>
    paymentController.getTransactionStatus(req, res)
  );

  router.post('/refund/:transaction_id', (req, res) => paymentController.refundPayment(req, res));

  return router;
}
