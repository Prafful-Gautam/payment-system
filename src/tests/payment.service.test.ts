// tests/payment.service.test.ts
import { PaymentService } from '../services/payment.service';
import { WalletService } from '../services/wallet.service';
import { GatewayFactory } from '../services/gateway-factory.service';
import { PaymentStatus } from '../types/payment.types';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let walletService: jest.Mocked<WalletService>;
  let gatewayFactory: jest.Mocked<GatewayFactory>;

  beforeEach(() => {
    walletService = {
      getBalance: jest.fn(),
      holdAmount: jest.fn(),
      deductHeldAmount: jest.fn(),
      releaseHold: jest.fn(),
    } as any;

    gatewayFactory = {
      getAdapter: jest.fn(),
    } as any;

    paymentService = new PaymentService(walletService, gatewayFactory, {} as any, {} as any);
  });

  describe('initiatePayment', () => {
    it('should split payment between wallet and gateway', async () => {
      walletService.getBalance.mockResolvedValue({
        wallet_id: 'wallet-1',
        balance: 300,
        currency: 'USD',
      } as any);

      const result = await paymentService.initiatePayment({
        user_id: 'user-1',
        order_id: 'order-1',
        amount: 1000,
        currency: 'USD',
        use_wallet: true,
        preferred_gateway: 'stripe',
        idempotency_key: 'key-1',
      });

      expect(result.wallet_amount).toBe(300);
      expect(result.gateway_amount).toBe(700);
      expect(result.payment_required).toBe(true);
    });

    it('should use only wallet if balance is sufficient', async () => {
      walletService.getBalance.mockResolvedValue({
        wallet_id: 'wallet-1',
        balance: 1500,
        currency: 'USD',
      } as any);

      const result = await paymentService.initiatePayment({
        user_id: 'user-1',
        order_id: 'order-1',
        amount: 1000,
        currency: 'USD',
        use_wallet: true,
        idempotency_key: 'key-1',
      });

      expect(result.wallet_amount).toBe(1000);
      expect(result.gateway_amount).toBe(0);
      expect(result.payment_required).toBe(false);
    });

    it('should return existing transaction for duplicate idempotency key', async () => {
      // Test idempotency behavior
      const existingTransaction = {
        transaction_id: 'txn-1',
        status: PaymentStatus.COMPLETED,
      };

      // Mock repository to return existing transaction
      jest
        .spyOn(paymentService['paymentRepo'], 'findByIdempotencyKey')
        .mockResolvedValue(existingTransaction as any);

      const result = await paymentService.initiatePayment({
        user_id: 'user-1',
        order_id: 'order-1',
        amount: 1000,
        currency: 'USD',
        idempotency_key: 'key-1',
      });

      expect(result.transaction_id).toBe('txn-1');
    });
  });
});
