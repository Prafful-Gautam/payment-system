import winston from 'winston';
import { PaymentRequest, InitiatePaymentResponse } from '@type/payment-request.types';
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'payment-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Helper function for structured logging
export function logPaymentEvent(event: string, data: Record<string, any>): void {
  logger.info(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Usage in services
export class PaymentService {
  async initiatePayment(request: PaymentRequest): Promise<InitiatePaymentResponse | void> {
    logPaymentEvent('payment_initiated', {
      transaction_id: request.idempotency_key,
      user_id: request.user_id,
      amount: request.amount,
      currency: request.currency,
      use_wallet: request.use_wallet,
    });

    // ... rest of implementation
  }
}
