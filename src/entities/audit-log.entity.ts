import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn('uuid')
  log_id: string;

  @Column('uuid')
  transaction_id: string;

  @Column({ type: 'string', length: 100 })
  event_type: string;

  @Column({ type: 'string', length: 255 })
  actor: string;

  @Column('text')
  details: string;

  @Column({ type: 'string', length: 45 })
  ip_address: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'string', length: 64 })
  hash: string;
}
