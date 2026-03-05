// services/gateway-factory.service.ts
import { StripeGatewayAdapter } from '../adapters/stripe-gateway.adapter';
import { RazorpayGatewayAdapter } from '../adapters/razorpay-gateway.adapter';
import { config } from '@config/index';

export interface ChargeRequest {
  amount: number;
  token: string;
  idempotencyKey: string;
  currency: string;
}

export interface ChargeResponse {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

export interface IGatewayAdapter {
  charge(request: ChargeRequest): Promise<ChargeResponse>;
  createPaymentIntent(params: any): Promise<any>;
  refund(transactionId: string, amount?: number): Promise<ChargeResponse>;
}

export class GatewayFactory {
  private adapters: Map<string, IGatewayAdapter>;

  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    // Initialize Stripe
    this.adapters.set('stripe', new StripeGatewayAdapter(config.stripe.apiKey));

    // Initialize Razorpay
    this.adapters.set(
      'razorpay',
      new RazorpayGatewayAdapter(config.razorpay.keyId, config.razorpay.keySecret)
    );
  }

  getAdapter(provider: string): IGatewayAdapter {
    const adapter = this.adapters.get(provider.toLowerCase());

    if (!adapter) {
      throw new Error(`Gateway adapter not found for provider: ${provider}`);
    }

    return adapter;
  }

  getSupportedGateways(): string[] {
    return Array.from(this.adapters.keys());
  }

  getStripeClient(): any {
    const adapter = this.adapters.get('stripe') as any;
    return adapter?.getStripeClient();
  }

  getRazorpayClient(): any {
    const adapter = this.adapters.get('razorpay') as any;
    return adapter?.getRazorpayClient();
  }
}
