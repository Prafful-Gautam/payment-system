import Stripe from 'stripe';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { CircuitBreakerOpenError, GatewayError } from '@error/custom.error';
import { ChargeRequest, ChargeResponse, IGatewayAdapter } from '@services/gateway-factory.service';

export class StripeGatewayAdapter implements IGatewayAdapter {
  private stripe: Stripe;
  private circuitBreaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      timeout: 20 * 1000,
    });
    this.circuitBreaker = new CircuitBreaker(5, 60000, 2);
  }

  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await this.performCharge(request);
      });
      return result;
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        return {
          success: false,
          error: 'Payment gateway temporarily unavailable. Please try again later.',
        };
      }
      throw error;
    }
  }

  private async performCharge(request: ChargeRequest): Promise<ChargeResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency.toLowerCase(),
          payment_method: request.token,
          confirm: true,
          return_url: 'https://your-domain.com/payment/return',
        },
        {
          idempotencyKey: request.idempotencyKey,
          timeout: 10000, // 10 second timeout
        }
      );

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          transaction_id: paymentIntent.id,
        };
      }

      return {
        success: false,
        error: `Payment status: ${paymentIntent.status}`,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new GatewayError(`Stripe error: ${(error as Error).message}`);
      }
      throw new GatewayError(`Unexpected error: ${(error as Error).message}`);
    }
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<{
    provider: string;
    client_secret: string;
    publishable_key: string;
  }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      provider: 'stripe',
      client_secret: paymentIntent.client_secret!,
      publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!,
    };
  }

  async refund(transactionId: string, amount?: number): Promise<ChargeResponse> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        success: refund.status === 'succeeded',
        transaction_id: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  getStripeClient(): Stripe {
    return this.stripe;
  }
}
