import { EntityManager, Repository } from 'typeorm';
import { WalletTransaction, Wallet } from '@entities/index';
import { WalletHold } from '@type/payment.types';
import {
  InsufficientBalanceError,
  WalletNotFoundError,
  ConcurrencyError,
} from '@error/custom.error';

export class WalletService {
  private holds: Map<string, WalletHold> = new Map();

  constructor(
    private readonly walletRepo: Repository<Wallet>,
    private readonly walletTxnRepo: Repository<WalletTransaction>
  ) {}

  async deductAmount(walletId: string, amount: number, manager?: EntityManager): Promise<void> {
    const maxRetries = 3;
    const repo = manager?.getRepository(Wallet) || this.walletRepo;
    const txnRepo = manager?.getRepository(WalletTransaction) || this.walletTxnRepo;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current wallet state with version
        const wallet = await repo.findOne({
          where: { wallet_id: walletId },
        });

        if (!wallet) {
          throw new WalletNotFoundError(walletId);
        }

        if (wallet.balance < amount) {
          throw new InsufficientBalanceError(`Required: ${amount}, Available: ${wallet.balance}`);
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = wallet.balance - amount;

        // Update with version check (optimistic locking)
        const result = await repo
          .createQueryBuilder()
          .update(Wallet)
          .set({
            balance: balanceAfter,
            updated_at: new Date(),
          })
          .where('wallet_id = :walletId', { walletId })
          .andWhere('version = :version', { version: wallet.version })
          .execute();

        if (result.affected === 0) {
          // Version conflict - retry
          await this.sleep(100 * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }

        // Log transaction
        await txnRepo.save({
          transaction_id: this.generateUUID(),
          wallet_id: walletId,
          transaction_type: 'debit',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          status: 'completed',
          created_at: new Date(),
        });

        return;
      } catch (error) {
        // if (error instanceof InsufficientBalanceError || error instanceof WalletNotFoundError) {
        //   throw error;
        // }

        if (attempt === maxRetries - 1) {
          throw new ConcurrencyError(`Failed to update wallet after ${maxRetries} retries`);
        }
        throw error;
      }
    }
  }

  async holdAmount(
    params: {
      userId: string;
      amount: number;
      referenceId: string;
    },
    manager?: EntityManager
  ): Promise<WalletHold> {
    const repo = manager?.getRepository(Wallet) || this.walletRepo;

    const wallet = await repo.findOne({
      where: { user_id: params.userId },
    });

    if (!wallet) {
      throw new WalletNotFoundError(`User ${params.userId} has no wallet`);
    }

    if (wallet.balance < params.amount) {
      throw new InsufficientBalanceError(
        `Required: ${params.amount}, Available: ${wallet.balance}`
      );
    }

    // Create hold record
    const hold: WalletHold = {
      id: this.generateUUID(),
      wallet_id: wallet.wallet_id,
      amount: params.amount,
      reference_id: params.referenceId,
    };

    // Store hold in memory
    this.holds.set(hold.id, hold);

    return hold;
  }

  async deductHeldAmount(holdId: string, manager?: EntityManager): Promise<void> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      throw new Error(`Hold with ID ${holdId} not found`);
    }

    const repo = manager?.getRepository(Wallet) || this.walletRepo;
    const txnRepo = manager?.getRepository(WalletTransaction) || this.walletTxnRepo;

    // Get current wallet state
    const wallet = await repo.findOne({
      where: { wallet_id: hold.wallet_id },
    });

    if (!wallet) {
      throw new WalletNotFoundError(hold.wallet_id);
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = wallet.balance - hold.amount;

    // Update wallet balance
    await repo
      .createQueryBuilder()
      .update(Wallet)
      .set({
        balance: balanceAfter,
        updated_at: new Date(),
      })
      .where('wallet_id = :walletId', { walletId: hold.wallet_id })
      .execute();

    // Log transaction
    await txnRepo.save({
      transaction_id: this.generateUUID(),
      wallet_id: hold.wallet_id,
      transaction_type: 'debit',
      amount: hold.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status: 'completed',
      reference_id: hold.reference_id,
      created_at: new Date(),
    });

    // Remove the hold
    this.holds.delete(holdId);
  }

  async releaseHold(holdId: string, manager?: EntityManager): Promise<void> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      throw new Error(`Hold with ID ${holdId} not found`);
    }

    // Simply remove the hold without deducting from wallet
    this.holds.delete(holdId);
  }

  async getBalance(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new WalletNotFoundError(`User ${userId} has no wallet`);
    }

    return wallet;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateUUID(): string {
    return require('crypto').randomUUID();
  }
}
