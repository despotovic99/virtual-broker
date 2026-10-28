// Konfiguracija se čita samo iz promenljivih okruženja. Tajne nikad nisu u kodu.
// Aplikacija ne kreće ako neka obavezna promenljiva nedostaje.

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  logging: boolean;
  migrationsRun: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  jwtIssuer: string;
  jwtAudience: string;
  refreshTokenTtlDays: number;
  /** Secure cookie (samo HTTPS); uključeno u produkciji. */
  cookieSecure: boolean;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  trustProxy: number;
  corsOrigins: string[];
  db: DbConfig;
  redis: RedisConfig;
  storage: StorageConfig;
  auth: AuthConfig;
}

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Nedostaje obavezna promenljiva okruženja: ${key}`);
  }
  return value.trim();
}

function optional(env: Env, key: string, fallback: string): string {
  const value = env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function integer(env: Env, key: string, fallback?: number): number {
  const raw = fallback === undefined ? required(env, key) : optional(env, key, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Promenljiva ${key} mora biti ceo nenegativan broj.`);
  }
  return value;
}

function boolean(env: Env, key: string, fallback: boolean): boolean {
  const raw = optional(env, key, String(fallback)).toLowerCase();
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`Promenljiva ${key} mora biti "true" ili "false".`);
  }
  return raw === 'true';
}

function nodeEnv(env: Env): AppConfig['nodeEnv'] {
  const value = optional(env, 'NODE_ENV', 'development');
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new Error('NODE_ENV mora biti development, test ili production.');
  }
  return value;
}

export function loadDbConfig(env: Env): DbConfig {
  return {
    host: required(env, 'DB_HOST'),
    port: integer(env, 'DB_PORT', 5432),
    user: required(env, 'DB_USER'),
    password: required(env, 'DB_PASSWORD'),
    name: required(env, 'DB_NAME'),
    logging: boolean(env, 'DB_LOGGING', false),
    migrationsRun: boolean(env, 'MIGRATIONS_RUN', false),
  };
}

function loadAuthConfig(env: Env, environment: AppConfig['nodeEnv']): AuthConfig {
  const secret = required(env, 'JWT_ACCESS_SECRET');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET mora imati najmanje 32 bajta.');
  }
  const accessTtl = integer(env, 'JWT_ACCESS_TTL_SECONDS', 600);
  const refreshDays = integer(env, 'REFRESH_TOKEN_TTL_DAYS', 7);
  if (accessTtl < 60 || accessTtl > 3600) throw new Error('JWT_ACCESS_TTL_SECONDS mora biti između 60 i 3600.');
  if (refreshDays < 1 || refreshDays > 90) throw new Error('REFRESH_TOKEN_TTL_DAYS mora biti između 1 i 90.');
  return {
    jwtAccessSecret: secret,
    jwtAccessTtlSeconds: accessTtl,
    jwtIssuer: optional(env, 'JWT_ISSUER', 'virtual-broker'),
    jwtAudience: optional(env, 'JWT_AUDIENCE', 'virtual-broker'),
    refreshTokenTtlDays: refreshDays,
    cookieSecure: environment === 'production',
  };
}

export function loadConfig(env: Env): AppConfig {
  const environment = nodeEnv(env);
  return {
    nodeEnv: environment,
    port: integer(env, 'PORT', 3000),
    trustProxy: integer(env, 'TRUST_PROXY', 0),
    corsOrigins: required(env, 'CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    db: loadDbConfig(env),
    redis: {
      host: required(env, 'REDIS_HOST'),
      port: integer(env, 'REDIS_PORT', 6379),
      password: required(env, 'REDIS_PASSWORD'),
    },
    storage: {
      endpoint: required(env, 'S3_ENDPOINT'),
      region: optional(env, 'S3_REGION', 'us-east-1'),
      accessKey: required(env, 'S3_ACCESS_KEY'),
      secretKey: required(env, 'S3_SECRET_KEY'),
      bucket: required(env, 'S3_BUCKET'),
      forcePathStyle: boolean(env, 'S3_FORCE_PATH_STYLE', true),
    },
    auth: loadAuthConfig(env, environment),
  };
}
