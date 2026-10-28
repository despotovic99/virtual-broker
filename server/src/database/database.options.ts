import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { DbConfig } from '../config/configuration.js';

// Iste opcije koriste aplikacija i TypeORM CLI (migracije).
// Šema baze ide isključivo kroz migracije; synchronize je uvek isključen.
export function buildDataSourceOptions(db: DbConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    synchronize: false,
    logging: db.logging,
    entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    migrationsTableName: 'migrations',
  };
}
