// repositories/payment.repository.ts
import { Repository, EntityManager } from 'typeorm';
import { PaymentTransaction } from '@entities/payment-transaction.entity';

export class PaymentRepository {
  private getRepository(manager?: EntityManager): Repository<PaymentTransaction> {
    return manager
      ? manager.getRepository(PaymentTransaction)
      : (global as any).dataSource.getRepository(PaymentTransaction);
  }

  async findById(
    transactionId: string,
    manager?: EntityManager
  ): Promise<PaymentTransaction | null> {
    const repo = manager ? this.getRepository(manager) : this.getRepository();
    return await repo.findOne({ where: { transaction_id: transactionId } });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PaymentTransaction | null> {
    const repo = this.getRepository();
    return await repo.findOne({ where: { idempotency_key: idempotencyKey } });
  }

  async create(data: Partial<PaymentTransaction>): Promise<PaymentTransaction> {
    const repo = this.getRepository();
    const transaction = repo.create(data);
    return await repo.save(transaction);
  }

  async update(
    transactionId: string,
    data: Partial<PaymentTransaction>,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager ? this.getRepository(manager) : this.getRepository();
    await repo.update({ transaction_id: transactionId }, data);
  }

  async findByGatewayTransactionId(
    gatewayTransactionId: string,
    manager?: EntityManager
  ): Promise<PaymentTransaction | null> {
    const repo = manager ? this.getRepository(manager) : this.getRepository();
    return await repo.findOne({ where: { gateway_transaction_id: gatewayTransactionId } });
  }
}
