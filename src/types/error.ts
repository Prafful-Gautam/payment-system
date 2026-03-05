export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PaymentError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export class InsufficientBalanceError extends PaymentError {
  constructor(required: number, available: number) {
    super('Wallet balance is insufficient for this transaction', 'INSUFFICIENT_BALANCE', 400, {
      required,
      available,
    });
    this.name = 'InsufficientBalanceError';
  }
}

export class GatewayError extends PaymentError {
  constructor(message: string, gatewayProvider?: string) {
    super(message, 'GATEWAY_ERROR', 502, { gateway_provider: gatewayProvider });
    this.name = 'GatewayError';
  }
}

export class ConcurrencyError extends PaymentError {
  constructor(message: string = 'Concurrent modification detected') {
    super(message, 'CONCURRENCY_ERROR', 409);
    this.name = 'ConcurrencyError';
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(transactionId: string) {
    super(`Payment transaction not found`, 'PAYMENT_NOT_FOUND', 404, {
      transaction_id: transactionId,
    });
    this.name = 'PaymentNotFoundError';
  }
}

export class IdempotencyConflictError extends PaymentError {
  constructor(existingTransactionId: string) {
    super('Request with this idempotency key already exists', 'IDEMPOTENCY_CONFLICT', 409, {
      existing_transaction_id: existingTransactionId,
    });
    this.name = 'IdempotencyConflictError';
  }
}
