import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config/configuration.js';
import { AccessModule } from './core/access/access.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { AuthModule } from './core/auth/auth.module.js';
import { CatalogModule } from './core/catalog/catalog.module.js';
import { ChecksModule } from './core/checks/checks.module.js';
import { ConstructionModule } from './core/construction/construction.module.js';
import { CostsModule } from './core/costs/costs.module.js';
import { DocumentsModule } from './core/documents/documents.module.js';
import { HandoverModule } from './core/handover/handover.module.js';
import { LegalWorkModule } from './core/legal/legal-work.module.js';
import { LegalTeamsModule } from './core/legal/legal-teams.module.js';
import { NotificationsModule } from './core/notifications/notifications.module.js';
import { PaymentsModule } from './core/payments/payments.module.js';
import { PurchasesModule } from './core/purchases/purchases.module.js';
import { RequestsModule } from './core/requests/requests.module.js';
import { UsersModule } from './core/users/users.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MarketsModule } from './markets/markets.module.js';
import { RedisModule } from './redis/redis.module.js';
import { StorageModule } from './storage/storage.module.js';

// Infrastruktura je ovde. Moduli jezgra idu u src/core, a paketi tržišta
// u src/markets (specifikacija F-34).
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [() => ({ ...loadConfig(process.env) })],
    }),
    DatabaseModule,
    RedisModule,
    StorageModule,
    MarketsModule,
    IntegrationsModule,
    AccessModule,
    AuditModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    ChecksModule,
    RequestsModule,
    CostsModule,
    LegalTeamsModule,
    PurchasesModule,
    LegalWorkModule,
    DocumentsModule,
    PaymentsModule,
    ConstructionModule,
    HandoverModule,
    HealthModule,
  ],
})
export class AppModule {}
