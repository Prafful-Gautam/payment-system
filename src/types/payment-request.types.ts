import { PaymentStatus } from '@type/payment.types';

export interface PaymentRequest {
  user_id: string;
  order_id: string;
  amount: number;
  currency: string;
  use_wallet: boolean;
  preferred_gateway?: string;
  idempotency_key: string;
  metadata?: Record<string, any>;
}

export interface InitiatePaymentResponse {
  transaction_id: string;
  total_amount: number;
  wallet_amount: number;
  gateway_amount: number;
  payment_required: boolean;
  gateway_info?: {
    provider: string;
    client_secret: string;
    publishable_key: string;
  };
  status: PaymentStatus;
}
