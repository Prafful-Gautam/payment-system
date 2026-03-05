// entities/payment-transaction.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PaymentStatus } from '@type/payment.types';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  transaction_id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  idempotency_key!: string;

  @Column({ type: 'varchar', length: 36 })
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  order_id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  wallet_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  gateway_amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 50 })
  payment_method!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gateway_provider?: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  status!: PaymentStatus;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gateway_transaction_id?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
