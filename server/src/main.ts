import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { bodyParserErrorHandler } from './common/errors/body-parser-error.handler.js';
import { validationExceptionFactory } from './common/errors/validation-exception.factory.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  // Broj proxy-ja ispred API-ja, da req.ip bude adresa klijenta.
  app.set('trust proxy', config.getOrThrow<number>('trustProxy'));
  app.disable('x-powered-by');

  app.useBodyParser('json', { limit: '100kb' });
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  // Potreban za refresh token cookie (/api/auth/refresh i /api/auth/logout).
  app.use(cookieParser());

  app.enableCors({
    origin: config.getOrThrow<string[]>('corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Greške iz middleware-a iznad (npr. neispravan JSON) ne smeju da izađu kao Express poruka.
  app.use(bodyParserErrorHandler);

  // Van API-ja izlazi samo ApiError (common/errors).
  app.useGlobalFilters(new ApiExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(config.getOrThrow<number>('port'), '0.0.0.0');
}

await bootstrap();
