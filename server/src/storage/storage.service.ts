import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as sleep } from 'node:timers/promises';
import type { StorageConfig } from '../config/configuration.js';

// Skladište fajlova preko S3 API-ja. U dev-u je to MinIO, a isti kod radi
// sa bilo kojim S3 kompatibilnim servisom.
@Injectable()
export class StorageService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    const storage = config.getOrThrow<StorageConfig>('storage');
    this.bucket = storage.bucket;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // MinIO nema healthcheck u docker-compose, pa ga čekamo ovde.
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await this.ensureBucket();
        return;
      } catch (error) {
        this.logger.warn(`Skladište nije dostupno (pokušaj ${attempt}/10).`);
        if (attempt === 10) {
          this.logger.error('Bucket nije proveren ni napravljen.', error instanceof Error ? error.stack : undefined);
          return;
        }
        await sleep(2000);
      }
    }
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  async putObject(key: string, body: Buffer, contentType: string, sha256Hex: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        ChecksumSHA256: Buffer.from(sha256Hex, 'hex').toString('base64'),
      }),
    );
  }

  async getObjectStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Objekat ${key} nema sadržaj.`);
    return result.Body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Proverava da li bucket postoji i da li je dostupan. */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.ping();
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Napravljen bucket ${this.bucket}.`);
        return;
      }
      throw error;
    }
  }
}
