// entities/wallet-transaction.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export type TransactionType = 'debit' | 'credit';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  transaction_id!: string;

  @Column({ type: 'varchar', length: 36 })
  wallet_id!: string;

  @Column({ type: 'varchar', length: 20 })
  transaction_type!: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance_before!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance_after!: number;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_id?: string;

  @CreateDateColumn()
  created_at!: Date;
}
