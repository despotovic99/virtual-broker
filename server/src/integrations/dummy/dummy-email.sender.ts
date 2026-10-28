/*
 * =============================================================================
 *  DUMMY INTEGRACIJA — EMAIL SE NE ŠALJE.
 *  TODO(integracija): zameniti pravim servisom za slanje (SMTP ili provajder).
 * =============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/** DUMMY: samo upisuje u log da bi email bio poslat. Sadržaj se ne loguje (lični podaci). */
@Injectable()
export class DummyEmailSender implements EmailSender {
  private readonly logger = new Logger('DummyEmailSender');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`[DUMMY EMAIL — nije poslat] tema: "${message.subject}"`);
    return Promise.resolve();
  }
}
