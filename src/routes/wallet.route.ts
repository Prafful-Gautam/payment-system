import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

export function createWalletRoutes(paymentController: PaymentController): Router {
  const router = Router();

  router.use(authenticate);

  router.get('/balance/:user_id', (req, res) => paymentController.getWalletBalance(req, res));

  return router;
}
