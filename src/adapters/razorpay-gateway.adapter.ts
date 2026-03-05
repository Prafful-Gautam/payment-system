// adapters/razorpay-gateway.adapter.ts
import Razorpay from 'razorpay';
import { IGatewayAdapter, ChargeRequest, ChargeResponse } from '@services/gateway-factory.service';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { CircuitBreakerOpenError, GatewayError } from '@error/custom.error';

export class RazorpayGatewayAdapter implements IGatewayAdapter {
  private razorpay: Razorpay;
  private circuitBreaker: CircuitBreaker;
  private keyId: string; // keep original key for registrations

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
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
          error: 'Razorpay gateway temporarily unavailable',
        };
      }
      throw error;
    }
  }

  private async performCharge(request: ChargeRequest): Promise<ChargeResponse> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(request.amount * 100), // Convert to paise
        currency: request.currency.toUpperCase(),
        payment_capture: true,
      });

      // Verify payment (in production, this comes from webhook)
      return {
        success: true,
        transaction_id: order.id,
      };
    } catch (error) {
      throw new GatewayError(`Razorpay error: ${(error as Error).message}`);
    }
  }

  async createPaymentIntent(params: any): Promise<any> {
    const order = await this.razorpay.orders.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toUpperCase(),
    });

    return {
      provider: 'razorpay',
      order_id: order.id,
      key_id: this.keyId,
    };
  }

  async refund(transactionId: string, amount?: number): Promise<ChargeResponse> {
    try {
      const refund = await this.razorpay.payments.refund(transactionId, {
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        success: true,
        transaction_id: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  getRazorpayClient(): Razorpay {
    return this.razorpay;
  }
}
