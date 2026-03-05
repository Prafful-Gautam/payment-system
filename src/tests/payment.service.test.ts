import { PaymentService } from '../services/payment.service';
import type { WalletService } from '../services/wallet.service';
import type { GatewayFactory, IGatewayAdapter } from '../services/gateway-factory.service';
import { PaymentStatus } from '../types/payment.types';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let walletService: jest.Mocked<WalletService>;
  let gatewayFactory: jest.Mocked<GatewayFactory>;
  let paymentRepo: any;
  let entityManager: any;

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

    paymentRepo = {
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
    };

    entityManager = {
      transaction: jest.fn(async (fn: any) => fn(entityManager)),
    };

    paymentService = new PaymentService(walletService as any, gatewayFactory as any, paymentRepo, entityManager);
  });

  describe('initiatePayment', () => {
    it('splits payment between wallet and gateway and creates gateway intent', async () => {
      paymentRepo.findByIdempotencyKey.mockResolvedValue(null);
      walletService.getBalance.mockResolvedValue({
        wallet_id: 'wallet-1',
        balance: 300,
        currency: 'USD',
      } as any);

      const adapter: jest.Mocked<IGatewayAdapter> = {
        charge: jest.fn(),
        createPaymentIntent: jest.fn().mockResolvedValue({ provider: 'stripe', client_secret: 'cs_123' }),
        refund: jest.fn(),
      };
      gatewayFactory.getAdapter.mockReturnValue(adapter as any);

      paymentRepo.create.mockImplementation(async (data: any) => data);

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
      expect(gatewayFactory.getAdapter).toHaveBeenCalledWith('stripe');
      expect(adapter.createPaymentIntent).toHaveBeenCalled();
    });

    it('uses only wallet if balance is sufficient (no gateway intent)', async () => {
      paymentRepo.findByIdempotencyKey.mockResolvedValue(null);
      walletService.getBalance.mockResolvedValue({
        wallet_id: 'wallet-1',
        balance: 1500,
        currency: 'USD',
      } as any);

      paymentRepo.create.mockImplementation(async (data: any) => data);

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
      expect(gatewayFactory.getAdapter).not.toHaveBeenCalled();
    });

    it('returns existing transaction for duplicate idempotency key', async () => {
      paymentRepo.findByIdempotencyKey.mockResolvedValue({
        transaction_id: 'txn-1',
        total_amount: 1000,
        wallet_amount: 0,
        gateway_amount: 1000,
        status: PaymentStatus.COMPLETED,
      });

      const result = await paymentService.initiatePayment({
        user_id: 'user-1',
        order_id: 'order-1',
        amount: 1000,
        currency: 'USD',
        use_wallet: false,
        idempotency_key: 'key-1',
      });

      expect(result.transaction_id).toBe('txn-1');
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('processMixedPayment', () => {
    it('holds wallet, charges gateway, commits wallet, updates status (success)', async () => {
      const transaction = {
        transaction_id: 't_1',
        user_id: 'u_1',
        wallet_amount: 200,
        gateway_amount: 800,
        currency: 'USD',
        idempotency_key: 'idem_1',
        gateway_provider: 'stripe',
      };
      paymentRepo.findById.mockResolvedValue(transaction);

      walletService.holdAmount.mockResolvedValue({ id: 'hold_1' } as any);

      const adapter: jest.Mocked<IGatewayAdapter> = {
        charge: jest.fn().mockResolvedValue({ success: true, transaction_id: 'gw_1' }),
        createPaymentIntent: jest.fn(),
        refund: jest.fn(),
      };
      gatewayFactory.getAdapter.mockReturnValue(adapter as any);

      const result = await paymentService.processMixedPayment('t_1', 'tok_1');

      expect(walletService.holdAmount).toHaveBeenCalled();
      expect(adapter.charge).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 800, token: 'tok_1', idempotencyKey: 'idem_1', currency: 'USD' })
      );
      expect(walletService.deductHeldAmount).toHaveBeenCalledWith('hold_1', expect.anything());
      expect(paymentRepo.update).toHaveBeenCalledWith(
        't_1',
        expect.objectContaining({ status: PaymentStatus.COMPLETED, gateway_transaction_id: 'gw_1' }),
        expect.anything()
      );
      expect(result).toEqual({ status: 'success', transaction_id: 't_1' });
    });

    it('releases wallet hold when gateway charge fails', async () => {
      const transaction = {
        transaction_id: 't_2',
        user_id: 'u_1',
        wallet_amount: 200,
        gateway_amount: 800,
        currency: 'USD',
        idempotency_key: 'idem_2',
        gateway_provider: 'stripe',
      };
      paymentRepo.findById.mockResolvedValue(transaction);

      walletService.holdAmount.mockResolvedValue({ id: 'hold_2' } as any);

      const adapter: jest.Mocked<IGatewayAdapter> = {
        charge: jest.fn().mockResolvedValue({ success: false, error: 'card_declined' }),
        createPaymentIntent: jest.fn(),
        refund: jest.fn(),
      };
      gatewayFactory.getAdapter.mockReturnValue(adapter as any);

      await expect(paymentService.processMixedPayment('t_2', 'tok_2')).rejects.toThrow(/Payment processing failed/i);
      expect(walletService.releaseHold).toHaveBeenCalledWith('hold_2', expect.anything());
      expect(walletService.deductHeldAmount).not.toHaveBeenCalled();
    });
  });
});
