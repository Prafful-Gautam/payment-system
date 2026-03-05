// Custom error classes
export class PaymentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProcessingError';
  }
}

export class GatewayPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayPaymentError';
  }
}

export class PaymentNotFoundError extends Error {
  constructor(transactionId: string) {
    super(`Payment transaction ${transactionId} not found`);
    this.name = 'PaymentNotFoundError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class WalletNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletNotFoundError';
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}
