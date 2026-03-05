// types/payment.types.ts
export enum PaymentStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface PaymentTransaction {
  transaction_id: string;
  user_id: string;
  order_id: string;
  total_amount: number;
  wallet_amount: number;
  gateway_amount: number;
  currency: string;
  gateway_provider?: string;
  status: PaymentStatus;
  idempotency_key: string;
}

export interface WalletHold {
  id: string;
  wallet_id: string;
  amount: number;
  reference_id: string;
}
