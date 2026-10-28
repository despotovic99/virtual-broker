import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DbConfig } from '../config/configuration.js';
import { buildDataSourceOptions } from './database.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DbConfig>('db');
        return {
          ...buildDataSourceOptions(db),
          migrationsRun: db.migrationsRun,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
