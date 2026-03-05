import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn('uuid')
  log_id: string;

  @Column('uuid')
  transaction_id: string;

  @Column({ length: 100 })
  event_type: string;

  @Column({ length: 255 })
  actor: string;

  @Column('text')
  details: string;

  @Column({ length: 45 })
  ip_address: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ length: 64 })
  hash: string;
}
