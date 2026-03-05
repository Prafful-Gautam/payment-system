import crypto from 'crypto';
import type { Request, Response } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import type { PaymentService } from '../services/payment.service';
import type { AuditService } from '../services/audit.service';
import type { GatewayFactory } from '../services/gateway-factory.service';
import { PaymentStatus } from '../types/payment.types';

function mockRes(): jest.Mocked<Response> {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('WebhookController', () => {
  let paymentService: jest.Mocked<PaymentService>;
  let auditService: jest.Mocked<AuditService>;
  let gatewayFactory: jest.Mocked<GatewayFactory>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    paymentService = {
      findByGatewayTransactionId: jest.fn(),
      updatePaymentStatus: jest.fn(),
      updatePaymentStatusPublic: jest.fn(),
      processRefund: jest.fn(),
    } as any;

    auditService = {
      logPaymentEvent: jest.fn(),
    } as any;

    gatewayFactory = {
      getStripeClient: jest.fn(),
      getRazorpayClient: jest.fn(),
    } as any;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('Stripe webhook: returns 400 on invalid signature', async () => {
    const stripeClient = {
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad sig');
        }),
      },
    };
    gatewayFactory.getStripeClient.mockReturnValue(stripeClient as any);
    gatewayFactory.getRazorpayClient.mockReturnValue({} as any);

    const controller = new WebhookController(paymentService as any, auditService as any, gatewayFactory as any);

    const req: any = {
      headers: { 'stripe-signature': 'sig' },
      body: Buffer.from('{}'),
      ip: '127.0.0.1',
    } satisfies Partial<Request>;
    const res = mockRes();

    await controller.handleStripeWebhook(req as Request, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('Stripe webhook: marks transaction completed on payment_intent.succeeded', async () => {
    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          amount: 1000,
          currency: 'usd',
          metadata: { transaction_id: 't_1' },
        },
      },
    };

    const stripeClient = {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(event),
      },
    };
    gatewayFactory.getStripeClient.mockReturnValue(stripeClient as any);
    gatewayFactory.getRazorpayClient.mockReturnValue({} as any);

    paymentService.findByGatewayTransactionId.mockResolvedValue({ transaction_id: 't_1' } as any);

    const controller = new WebhookController(paymentService as any, auditService as any, gatewayFactory as any);

    const req: any = {
      headers: { 'stripe-signature': 'sig' },
      body: Buffer.from('{}'),
      ip: '127.0.0.1',
    } satisfies Partial<Request>;
    const res = mockRes();

    await controller.handleStripeWebhook(req as Request, res as any);

    expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 't_1',
        status: PaymentStatus.COMPLETED,
        gatewayTransactionId: 'pi_1',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('Razorpay webhook: returns 400 when signature mismatch', async () => {
    const controller = new WebhookController(paymentService as any, auditService as any, gatewayFactory as any);

    const req: any = {
      headers: { 'x-razorpay-signature': 'bad' },
      body: { event: 'payment.captured', payload: {} },
      ip: '127.0.0.1',
    } satisfies Partial<Request>;
    const res = mockRes();

    await controller.handleRazorpayWebhook(req as Request, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('Razorpay webhook: marks transaction completed on payment.captured', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'rzpwh_test';

    paymentService.findByGatewayTransactionId.mockResolvedValue({ transaction_id: 't_2' } as any);

    const controller = new WebhookController(paymentService as any, auditService as any, gatewayFactory as any);

    const body = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', amount: 5000, currency: 'INR' } } },
    };
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    const req: any = {
      headers: { 'x-razorpay-signature': signature },
      body,
      ip: '127.0.0.1',
    } satisfies Partial<Request>;
    const res = mockRes();

    await controller.handleRazorpayWebhook(req as Request, res as any);

    expect(paymentService.updatePaymentStatusPublic).toHaveBeenCalledWith('t_2', 'completed');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

