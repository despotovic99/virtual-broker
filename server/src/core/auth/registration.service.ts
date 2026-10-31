import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { isUniqueViolation } from '../../common/utils/db-error.util.js';
import { auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../users/password.service.js';
import { normalizeEmail, UsersService } from '../users/users.service.js';
import type { ClientMeta } from './auth.service.js';
import type { RegisterDto, RegisterResponseDto } from './dto/register.dto.js';
import { RateLimiterService } from './rate-limiter.service.js';

const REGISTER_PER_IP = 5;
const REGISTER_WINDOW_SECONDS = 60 * 60;

const ACCEPTED: RegisterResponseDto = {
  status: 'ACCEPTED',
  message: 'Ako su podaci ispravni, nalog je napravljen. Prijavite se svojim email-om i lozinkom.',
};

/**
 * Samostalna registracija kupca (F-35). Uloga je uvek samo BUYER.
 *
 * Bez enumeracije naloga: ako email već postoji, odgovor je isti kao za nov
 * nalog i ništa se ne menja. Lozinka se hešira u oba slučaja, pa ni trajanje
 * odgovora ne otkriva da nalog postoji.
 *
 * DUMMY: potvrda email adrese ne postoji. Nalog je aktivan odmah.
 * TODO(integracija): slanje linka za potvrdu email-a preko pravog email servisa,
 * i obaveštenje vlasniku postojećeg naloga da je neko pokušao registraciju.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly rateLimiter: RateLimiterService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta): Promise<RegisterResponseDto> {
    if (meta.ip) await this.rateLimiter.consume('register-ip', meta.ip, REGISTER_PER_IP, REGISTER_WINDOW_SECONDS);
    const email = normalizeEmail(dto.email);
    // Skupa operacija van konekcije, i za postojeći email (isto trajanje).
    const passwordHash = await this.passwords.hash(dto.password);

    let created = false;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await this.users.findByEmailWithRoles(queryRunner.manager, email);
      if (!existing) {
        const userId = await this.users.createBuyer(queryRunner.manager, {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          language: dto.language,
        });
        await this.audit.record(queryRunner.manager, {
          market: null,
          actorId: userId,
          action: 'user.registered',
          entityType: 'user',
          entityId: userId,
          data: {
            roles: ['BUYER'],
            changes: auditInitial(
              { email, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), language: dto.language, roles: ['BUYER'] },
              ['email', 'firstName', 'lastName', 'language', 'roles'],
            ),
          },
        });
        created = true;
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      // Istovremena registracija istog email-a: isti odgovor kao za postojeći nalog.
      if (isUniqueViolation(error)) return ACCEPTED;
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    // Spoljni efekat posle commit-a (DUMMY: email za potvrdu se ne šalje).
    if (created) this.logger.log('[DUMMY] Email za potvrdu adrese nije poslat (integracija nije urađena).');
    return ACCEPTED;
  }
}
