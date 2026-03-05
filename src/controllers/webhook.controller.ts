import { Request, Response } from 'express';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { PaymentService } from '../services/payment.service';
import { AuditService, AuditEventType } from '../services/audit.service';
import { GatewayFactory } from '../services/gateway-factory.service';
import { PaymentStatus } from '@type/payment.types';

export class WebhookController {
  private stripe: Stripe;
  private razorpay: Razorpay;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
    private readonly gatewayFactory: GatewayFactory
  ) {
    this.stripe = this.gatewayFactory.getStripeClient();
    this.razorpay = this.gatewayFactory.getRazorpayClient();
  }

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      await this.processStripeEvent(event, req.ip || 'unknown');
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async processStripeEvent(event: Stripe.Event, ipAddress: string): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event, ipAddress);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event, ipAddress);
        break;

      case 'charge.refunded':
        await this.handleRefund(event, ipAddress);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(event: Stripe.Event, ipAddress: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const transactionId = paymentIntent.metadata.transaction_id;

    if (!transactionId) {
      console.error('No transaction_id in payment intent metadata');
      return;
    }

    // Update transaction status
    const transaction = await this.paymentService.findByGatewayTransactionId(paymentIntent.id);
    if (transaction) {
      await this.paymentService.updateIPaymentStatus({
        transactionId: transaction.transaction_id,
        status: PaymentStatus.COMPLETED,
        gatewayTransactionId: paymentIntent.id,
      });
    }

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transactionId,
      eventType: AuditEventType.GATEWAY_CHARGED,
      actor: 'stripe_webhook',
      details: {
        gateway_transaction_id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      },
      ipAddress: ipAddress,
    });
  }

  private async handlePaymentFailure(event: Stripe.Event, ipAddress: string): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const transactionId = paymentIntent.metadata.transaction_id;

    if (!transactionId) {
      console.error('No transaction_id in payment intent metadata');
      return;
    }

    // Rollback wallet deduction
    const transaction = await this.paymentService.findByGatewayTransactionId(paymentIntent.id);
    if (transaction) {
      await this.paymentService.updateIPaymentStatus({
        transactionId: transaction.transaction_id,
        status: PaymentStatus.FAILED,
        gatewayTransactionId: paymentIntent.id,
      });
    }

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transactionId,
      eventType: AuditEventType.PAYMENT_FAILED,
      actor: 'stripe_webhook',
      details: {
        gateway_transaction_id: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message || 'Unknown error',
      },
      ipAddress: ipAddress,
    });
  }

  private async handleRefund(event: Stripe.Event, ipAddress: string): Promise<void> {
    const charge = event.data.object as Stripe.Charge;

    // Find transaction by gateway charge ID
    const transaction = await this.paymentService.findByGatewayTransactionId(
      charge.payment_intent as string
    );

    if (!transaction) {
      console.error(`Transaction not found for charge: ${charge.id}`);
      return;
    }

    // Process refund
    await this.paymentService.processRefund(
      transaction.transaction_id,
      charge.amount_refunded / 100
    );

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transaction.transaction_id,
      eventType: AuditEventType.REFUND_COMPLETED,
      actor: 'stripe_webhook',
      ipAddress,
      details: {
        refund_amount: charge.amount_refunded / 100,
        currency: charge.currency,
      },
    });
  }

  async handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    let event: any;

    try {
      // Verify webhook signature for Razorpay
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('Razorpay webhook signature verification failed');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      event = req.body;
    } catch (error) {
      console.error('Razorpay webhook signature verification failed:', error);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      await this.processRazorpayEvent(event, req.ip || 'unknown');
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Razorpay webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async processRazorpayEvent(event: any, ipAddress: string): Promise<void> {
    switch (event.event) {
      case 'payment.captured':
        await this.handleRazorpayPaymentSuccess(event, ipAddress);
        break;

      case 'payment.failed':
        await this.handleRazorpayPaymentFailure(event, ipAddress);
        break;

      case 'refund.created':
        await this.handleRazorpayRefund(event, ipAddress);
        break;

      default:
        console.log(`Unhandled Razorpay event: ${event.event}`);
    }
  }

  private async handleRazorpayPaymentSuccess(event: any, ipAddress: string): Promise<void> {
    const payment = event.payload.payment.entity;

    // Find transaction by gateway charge ID
    const transaction = await this.paymentService.findByGatewayTransactionId(payment.id);

    if (!transaction) {
      console.error(`Transaction not found for Razorpay payment: ${payment.id}`);
      return;
    }

    // Update payment status to completed
    await this.paymentService.updatePaymentStatus(transaction.transaction_id, 'completed');

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transaction.transaction_id,
      eventType: AuditEventType.PAYMENT_COMPLETED,
      actor: 'razorpay_webhook',
      details: {
        gateway_transaction_id: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
      },
      ipAddress: ipAddress,
    });
  }

  private async handleRazorpayPaymentFailure(event: any, ipAddress: string): Promise<void> {
    const payment = event.payload.payment.entity;

    // Find transaction by gateway charge ID
    const transaction = await this.paymentService.findByGatewayTransactionId(payment.id);

    if (!transaction) {
      console.error(`Transaction not found for Razorpay payment: ${payment.id}`);
      return;
    }

    // Update payment status to failed
    await this.paymentService.updatePaymentStatus(transaction.transaction_id, 'failed');

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transaction.transaction_id,
      eventType: AuditEventType.PAYMENT_FAILED,
      actor: 'razorpay_webhook',
      details: {
        gateway_transaction_id: payment.id,
        error_code: payment.error_code,
        error_description: payment.error_description,
      },
      ipAddress: ipAddress,
    });
  }

  private async handleRazorpayRefund(event: any, ipAddress: string): Promise<void> {
    const refund = event.payload.refund.entity;

    // Find transaction by gateway charge ID
    const transaction = await this.paymentService.findByGatewayTransactionId(refund.payment_id);

    if (!transaction) {
      console.error(`Transaction not found for Razorpay refund: ${refund.id}`);
      return;
    }

    // Process refund
    await this.paymentService.processRefund(transaction.transaction_id, refund.amount / 100);

    // Log audit event
    await this.auditService.logPaymentEvent({
      transactionId: transaction.transaction_id,
      eventType: AuditEventType.REFUND_COMPLETED,
      actor: 'razorpay_webhook',
      details: {
        refund_amount: refund.amount / 100,
        currency: refund.currency,
        refund_id: refund.id,
      },
      ipAddress: ipAddress,
    });
  }
}
