import { Injectable, Logger, RequestMethod, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { getAccessRule, type AccessRule, type AccessTarget } from './access.decorators.js';

// Ključevi metapodataka koje Nest postavlja u @Controller, @Get, @Post...
// (PATH_METADATA i METHOD_METADATA iz @nestjs/common/constants).
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

/**
 * Na startu proverava da svaka ruta ima oznaku pristupa (@Public,
 * @Authenticated ili @RequireCapabilities). Ako neka nema, API ne krene.
 * U dev-u ispisuje tabelu ruta i prava.
 */
@Injectable()
export class AccessAuditService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccessAuditService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const missing: string[] = [];
    const rows: string[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const prototype: Record<string, unknown> = Object.getPrototypeOf(instance);
      const controllerPath = this.reflector.get<string | string[] | undefined>(PATH_METADATA, metatype);

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const path = this.reflector.get<string | string[] | undefined>(PATH_METADATA, handler);
        if (path === undefined) continue;

        const method = this.reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
        const route = `${method === undefined ? '?' : RequestMethod[method]} /${[controllerPath, path].flat().filter(Boolean).join('/')}`;
        const rule = getAccessRule(this.reflector, handler as AccessTarget, metatype);
        if (!rule) missing.push(`${route} (${metatype.name}.${name})`);
        rows.push(`${route.padEnd(36)} ${this.describe(rule)}`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Rute bez oznake pristupa:\n${missing.map((route) => `  - ${route}`).join('\n')}`);
    }
    if (this.config.getOrThrow<string>('nodeEnv') === 'development') {
      this.logger.log(`Prava pristupa po rutama:\n${rows.sort().join('\n')}`);
    }
  }

  private describe(rule: AccessRule | undefined): string {
    if (!rule) return 'NEMA OZNAKE';
    if (rule.kind === 'public') return 'javno';
    if (rule.kind === 'authenticated') return 'prijavljen korisnik';
    return rule.capabilities.join(', ');
  }
}
