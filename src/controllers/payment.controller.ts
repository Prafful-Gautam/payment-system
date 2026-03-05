import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { WalletService } from '../services/wallet.service';
import { PaymentError, InsufficientBalanceError, PaymentNotFoundError } from '@type/error';

export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
  ) {}

  async initiatePayment(req: Request, res: Response): Promise<void> {
    try {
      const {
        user_id,
        order_id,
        amount,
        currency = 'USD',
        use_wallet = false,
        preferred_gateway,
        idempotency_key,
        metadata,
      } = req.body;

      // Validate required fields
      if (!user_id || !order_id || !amount || !idempotency_key) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: {
              required: ['user_id', 'order_id', 'amount', 'idempotency_key'],
            },
          },
        });
        return;
      }

      const result = await this.paymentService.initiatePayment({
        user_id,
        order_id,
        amount: parseFloat(amount),
        currency,
        use_wallet,
        preferred_gateway,
        idempotency_key,
        metadata,
      });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        throw error;
      }
    }
  }

  async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id, gateway_payment_method, gateway_token } = req.body;

      if (!transaction_id || !gateway_token) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            details: {
              required: ['transaction_id', 'gateway_token'],
            },
          },
        });
        return;
      }

      const result = await this.paymentService.processMixedPayment(transaction_id, gateway_token);

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        throw error;
      }
    }
  }

  async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id } = req.params;

      const transaction = await this.paymentService.getPaymentTransactionPublic(
        transaction_id as string
      );

      if (!transaction) {
        throw new PaymentNotFoundError(transaction_id as string);
      }

      res.status(200).json(transaction);
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        throw error;
      }
    }
  }

  async getWalletBalance(req: Request, res: Response): Promise<void> {
    try {
      const { user_id } = req.params;

      const wallet = await this.walletService.getBalance(user_id as string);

      res.status(200).json({
        wallet_id: wallet.wallet_id,
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        throw error;
      }
    }
  }

  async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id } = req.params;
      const { amount, reason } = req.body;

      // const result = await this.paymentService.refundPayment(
      //   transaction_id,
      //   amount ? parseFloat(amount) : undefined,
      //   reason
      // );

      res.status(200).json({});
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        throw error;
      }
    }
  }
}
