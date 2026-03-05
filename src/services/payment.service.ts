// services/payment.service.ts
import { EntityManager } from 'typeorm';
import { WalletService, GatewayFactory } from '@services/index';
import { PaymentRepository } from '@repositories/index';
import { PaymentRequest, InitiatePaymentResponse } from '@type/payment-request.types';
import { PaymentStatus, PaymentTransaction, WalletHold } from '@type/payment.types';
import {
  GatewayPaymentError,
  PaymentNotFoundError,
  PaymentProcessingError,
} from '@error/custom.error';

export class PaymentService {
  constructor(
    private readonly walletService: WalletService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly paymentRepo: PaymentRepository,
    private readonly entityManager: EntityManager
  ) {}

  async processMixedPayment(
    transactionId: string,
    gatewayToken: string
  ): Promise<{ status: string; transaction_id: string }> {
    return await this.entityManager.transaction(async (transactionManager) => {
      let walletHold: WalletHold | null = null;

      try {
        // Phase 1: Prepare - Hold wallet funds
        const payment = await this.getPaymentTransaction(transactionId, transactionManager);

        if (payment.wallet_amount > 0) {
          walletHold = await this.walletService.holdAmount(
            {
              userId: payment.user_id,
              amount: payment.wallet_amount,
              referenceId: transactionId,
            },
            transactionManager
          );
        }

        // Phase 2: Execute gateway payment
        let gatewayResult;
        if (payment.gateway_amount > 0) {
          const gatewayAdapter = this.gatewayFactory.getAdapter(payment.gateway_provider!);

          gatewayResult = await gatewayAdapter.charge({
            amount: payment.gateway_amount,
            token: gatewayToken,
            idempotencyKey: payment.idempotency_key,
            currency: payment.currency,
          });

          if (!gatewayResult.success) {
            throw new GatewayPaymentError(gatewayResult.error ?? '');
          }
        }

        // Phase 3: Commit - Deduct wallet amount
        if (payment.wallet_amount > 0 && walletHold) {
          await this.walletService.deductHeldAmount(walletHold.id, transactionManager);
        }

        // Update payment status
        await this.updatePaymentStatus(
          {
            transactionId: transactionId,
            status: PaymentStatus.COMPLETED,
            gatewayTransactionId: gatewayResult?.transaction_id,
          },
          transactionManager
        );

        return {
          status: 'success',
          transaction_id: transactionId,
        };
      } catch (error) {
        // Rollback: Release held wallet funds
        if (walletHold) {
          await this.walletService.releaseHold(walletHold.id, transactionManager);
        }

        throw new PaymentProcessingError(`Payment processing failed: ${(error as Error).message}`);
      }
    });
  }

  private async getPaymentTransaction(
    transactionId: string,
    manager: EntityManager
  ): Promise<PaymentTransaction> {
    const payment = await this.paymentRepo.findById(transactionId, manager);
    if (!payment) {
      throw new PaymentNotFoundError(transactionId);
    }
    return payment;
  }

  async updatePaymentStatus(
    params: {
      transactionId: string;
      status: PaymentStatus | string;
      gatewayTransactionId?: string;
    },
    manager?: EntityManager
  ): Promise<void> {
    const paymentStatus =
      typeof params.status === 'string' ? (params.status as PaymentStatus) : params.status;
    await this.paymentRepo.update(
      params.transactionId,
      {
        status: paymentStatus,
        gateway_transaction_id: params.gatewayTransactionId,
        updated_at: new Date(),
      },
      manager
    );
  }

  async initiatePayment(request: PaymentRequest): Promise<InitiatePaymentResponse> {
    // Check if request with same idempotency key exists
    const existing = await this.paymentRepo.findByIdempotencyKey(request.idempotency_key);

    if (existing) {
      // Return existing transaction instead of creating new one
      return this.mapToInitiateResponse(existing);
    }

    // Get wallet balance if wallet payment is requested
    let walletAmount = 0;
    let gatewayAmount = request.amount;

    if (request.use_wallet) {
      const wallet = await this.walletService.getBalance(request.user_id);
      walletAmount = Math.min(wallet.balance, request.amount);
      gatewayAmount = request.amount - walletAmount;
    }

    // Create new transaction with idempotency key
    const transaction = await this.paymentRepo.create({
      transaction_id: this.generateUUID(),
      idempotency_key: request.idempotency_key,
      user_id: request.user_id,
      order_id: request.order_id,
      total_amount: request.amount,
      wallet_amount: walletAmount,
      gateway_amount: gatewayAmount,
      currency: request.currency,
      payment_method: this.determinePaymentMethod(walletAmount, gatewayAmount),
      gateway_provider: request.preferred_gateway,
      status: PaymentStatus.INITIATED,
      metadata: request.metadata,
      created_at: new Date(),
    });

    // Prepare gateway info if gateway payment is needed
    let gatewayInfo;
    if (gatewayAmount > 0 && request.preferred_gateway) {
      const adapter = this.gatewayFactory.getAdapter(request.preferred_gateway);
      gatewayInfo = await adapter.createPaymentIntent({
        amount: gatewayAmount,
        currency: request.currency,
        metadata: {
          transaction_id: transaction.transaction_id,
          user_id: request.user_id,
        },
      });
    }

    return {
      transaction_id: transaction.transaction_id,
      total_amount: transaction.total_amount,
      wallet_amount: transaction.wallet_amount,
      gateway_amount: transaction.gateway_amount,
      payment_required: gatewayAmount > 0,
      gateway_info: gatewayInfo,
      status: transaction.status,
    };
  }

  private determinePaymentMethod(walletAmount: number, gatewayAmount: number): string {
    if (walletAmount > 0 && gatewayAmount > 0) return 'mixed';
    if (walletAmount > 0) return 'wallet';
    return 'card';
  }

  private mapToInitiateResponse(transaction: PaymentTransaction): InitiatePaymentResponse {
    return {
      transaction_id: transaction.transaction_id,
      total_amount: transaction.total_amount,
      wallet_amount: transaction.wallet_amount,
      gateway_amount: transaction.gateway_amount,
      payment_required: transaction.gateway_amount > 0,
      status: transaction.status,
    };
  }

  private generateUUID(): string {
    return require('crypto').randomUUID();
  }

  async findByGatewayTransactionId(
    gatewayTransactionId: string,
    manager?: EntityManager
  ): Promise<PaymentTransaction | null> {
    return await this.paymentRepo.findByGatewayTransactionId(gatewayTransactionId, manager);
  }

  async processRefund(
    transactionId: string,
    refundAmount: number,
    manager?: EntityManager
  ): Promise<void> {
    // Update payment status and handle refund logic
    await this.paymentRepo.update(
      transactionId,
      {
        status: PaymentStatus.REFUNDED,
        updated_at: new Date(),
      },
      manager
    );
  }

  async getPaymentTransactionPublic(transactionId: string): Promise<PaymentTransaction | null> {
    return await this.paymentRepo.findById(transactionId);
  }

  async updatePaymentStatusPublic(
    transactionId: string,
    status: string,
    manager?: EntityManager
  ): Promise<void> {
    const paymentStatus = status as PaymentStatus;
    await this.paymentRepo.update(
      transactionId,
      {
        status: paymentStatus,
        updated_at: new Date(),
      },
      manager
    );
  }
}
