import express, { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

export function createWebhookRoutes(webhookController: WebhookController): Router {
  const router = express.Router();

  // Raw body parser for Stripe signature verification
  router.post('/stripe', express.raw({ type: 'application/json' }), (req, res) =>
    webhookController.handleStripeWebhook(req, res)
  );

  // JSON body parser for Razorpay webhook
  router.post('/razorpay', express.json(), (req, res) =>
    webhookController.handleRazorpayWebhook(req, res)
  );

  return router;
}
