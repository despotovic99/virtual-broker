// Ulaz za TypeORM CLI (migracije). Pokreće se iz kompajliranog dist-migrations/ foldera.
//
// U api kontejneru DB_* promenljive već postoje. Kada se komanda pokreće sa
// hosta (cd server && npm run migration:...), čita se root .env i koristi
// baza iz docker-compose-a na 127.0.0.1.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { loadDbConfig } from '../config/configuration.js';
import { buildDataSourceOptions } from './database.options.js';

if (!process.env.DB_HOST) {
  const rootEnv = resolve(process.cwd(), '..', '.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT ??= process.env.POSTGRES_HOST_PORT;
  process.env.DB_USER ??= process.env.POSTGRES_USER;
  process.env.DB_PASSWORD ??= process.env.POSTGRES_PASSWORD;
  process.env.DB_NAME ??= process.env.POSTGRES_DB;
}

export default new DataSource(buildDataSourceOptions(loadDbConfig(process.env)));
