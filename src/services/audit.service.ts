import { Repository } from 'typeorm';
import { AuditLog } from '@entities/index';
import * as crypto from 'crypto';

export enum AuditEventType {
  PAYMENT_INITIATED = 'payment_initiated',
  WALLET_DEBITED = 'wallet_debited',
  GATEWAY_CHARGED = 'gateway_charged',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_INITIATED = 'refund_initiated',
  REFUND_COMPLETED = 'refund_completed',
}

export interface AuditLogParams {
  transactionId: string;
  eventType: AuditEventType;
  actor: string;
  details: Record<string, any>;
  ipAddress: string;
}

export class AuditService {
  constructor(private readonly auditRepo: Repository<AuditLog>) {}

  async logPaymentEvent(params: AuditLogParams): Promise<void> {
    const detailsJson = JSON.stringify(params.details);
    const hash = this.computeHash(params.transactionId, params.eventType, detailsJson);

    const auditLog = this.auditRepo.create({
      log_id: this.generateUUID(),
      transaction_id: params.transactionId,
      event_type: params.eventType,
      actor: params.actor,
      details: detailsJson,
      ip_address: params.ipAddress,
      timestamp: new Date(),
      hash: hash,
    });

    await this.auditRepo.save(auditLog);
  }

  async getTransactionAuditTrail(transactionId: string): Promise<AuditLog[]> {
    return await this.auditRepo.find({
      where: { transaction_id: transactionId },
      order: { timestamp: 'ASC' },
    });
  }

  async verifyAuditIntegrity(logId: string): Promise<boolean> {
    const log = await this.auditRepo.findOne({
      where: { log_id: logId },
    });

    if (!log) {
      return false;
    }

    const computedHash = this.computeHash(log.transaction_id, log.event_type, log.details);

    return computedHash === log.hash;
  }

  private computeHash(transactionId: string, eventType: string, details: string): string {
    const data = `${transactionId}:${eventType}:${details}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }
}
