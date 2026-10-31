// Ulaz za TypeORM CLI (migracije). Pokreće se iz kompajliranog dist/ foldera.
//
// Migracije se pokreću isključivo iz api kontejnera, gde su DB_* promenljive
// već postavljene (docker-compose.yml), na primer:
//   docker compose exec api npm run migration:run:dev
import { DataSource } from 'typeorm';
import { loadDbConfig } from '../config/configuration.js';
import { buildDataSourceOptions } from './database.options.js';

if (!process.env.DB_HOST) {
  throw new Error('DB_HOST nije postavljen. Migracije se pokreću iz kontejnera: docker compose exec api npm run <komanda>');
}

export default new DataSource(buildDataSourceOptions(loadDbConfig(process.env)));
