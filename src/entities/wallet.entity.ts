import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryColumn('uuid')
  wallet_id: string;

  @Column('uuid')
  user_id: string;

  @Column('decimal', { precision: 19, scale: 4 })
  balance: number;

  @Column({ type: 'string', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['active', 'frozen', 'closed'],
    default: 'active',
  })
  status: string;

  @VersionColumn()
  version: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
