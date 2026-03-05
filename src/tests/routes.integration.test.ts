import express from 'express';
import request from 'supertest';

// Mock auth + rate limiter to keep integration tests focused on routing
jest.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u_test', email: 't@example.com', role: 'user' };
    next();
  },
}));

jest.mock('../middleware/rate-limiter.middleware', () => ({
  rateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

import { createPaymentRoutes } from '../routes/payment.route';
import { createWalletRoutes } from '../routes/wallet.route';
import { createWebhookRoutes } from '../routes/webhook.routes';

describe('routes integration', () => {
  it('wires /api/v1/payments endpoints', async () => {
    const app = express();
    app.use(express.json());

    const paymentController: any = {
      initiatePayment: (req: any, res: any) => res.status(200).json({ ok: true, body: req.body }),
      processPayment: (_req: any, res: any) => res.status(200).json({ ok: true }),
      getTransactionStatus: (req: any, res: any) => res.status(200).json({ id: req.params.transaction_id }),
      refundPayment: (_req: any, res: any) => res.status(200).json({}),
      getWalletBalance: (_req: any, res: any) => res.status(200).json({}),
    };

    app.use('/api/v1/payments', createPaymentRoutes(paymentController));

    await request(app)
      .post('/api/v1/payments/initiate')
      .send({ user_id: 'u1', order_id: 'o1', amount: 10, idempotency_key: 'k1' })
      .expect(200);

    await request(app).post('/api/v1/payments/process').send({ transaction_id: 't1', gateway_token: 'tok' }).expect(200);

    await request(app).get('/api/v1/payments/transaction/t1').expect(200);
  });

  it('wires /api/v1/wallet endpoints', async () => {
    const app = express();
    app.use(express.json());

    const paymentController: any = {
      getWalletBalance: (req: any, res: any) => res.status(200).json({ user_id: req.params.user_id, balance: 0 }),
    };

    app.use('/api/v1/wallet', createWalletRoutes(paymentController));

    await request(app).get('/api/v1/wallet/balance/u1').expect(200);
  });

  it('wires /webhooks endpoints', async () => {
    const app = express();

    const webhookController: any = {
      handleStripeWebhook: (_req: any, res: any) => res.status(200).json({ received: true }),
      handleRazorpayWebhook: (_req: any, res: any) => res.status(200).json({ received: true }),
    };

    app.use('/webhooks', createWebhookRoutes(webhookController));

    // Stripe route uses express.raw(), so send a buffer
    await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', 'sig')
      .set('content-type', 'application/json')
      .send(Buffer.from('{}'))
      .expect(200);

    // Razorpay route uses express.json()
    await request(app).post('/webhooks/razorpay').send({ event: 'payment.captured' }).expect(200);
  });
});

