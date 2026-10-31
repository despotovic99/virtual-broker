import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CHECK_INTEGRATIONS, type CheckIntegration, type IntegrationInput, type IntegrationResult } from '../../integrations/integration.types.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { CheckDefinition, CheckSubject, Localized } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuditChange } from '../audit/entities/audit-event.entity.js';
import type { Developer } from '../catalog/entities/developer.entity.js';
import type { Project } from '../catalog/entities/project.entity.js';
import { ChecksRepository, type NewCheck } from './checks.repository.js';
import type { Check } from './entities/check.entity.js';
import { buildSemaphore, worstOf, type SemaphoreResult } from './semaphore.js';

export interface ProjectSemaphore {
  developer: SemaphoreResult;
  project: SemaphoreResult;
  overall: SemaphoreResult['overall'];
  hardBlocked: boolean;
  containsDummyData: boolean;
}

/** Rezultat jedne automatske provere, pre upisa u bazu. */
export interface AutomaticCheckResult {
  definition: CheckDefinition;
  result: IntegrationResult;
}

/** Tekst uz svaki semafor (F-35 P5, README pravilo 7). */
export const SEMAPHORE_DISCLAIMER: Localized = {
  sr: 'Ovo je informacija iz javnih registara, a ne pravni savet.',
  en: 'This is information from public registers, not legal advice.',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Audit izmene provera: `check.KOD` → prethodni i novi status (svaki upis je nov rezultat provere). */
export function checkStatusChanges(
  previous: ReadonlyMap<string, string>,
  entries: readonly { code: string; status: string }[],
): Record<string, AuditChange> {
  return Object.fromEntries(entries.map((entry) => [`check.${entry.code}`, { from: previous.get(entry.code) ?? null, to: entry.status }]));
}

/**
 * Provere i semafor (F-05 – F-08). Metodi sa EntityManager-om učestvuju u
 * tuđoj konekciji. `fetchAutomatic` zove spoljne izvore i ne dira bazu.
 */
@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name);

  constructor(
    private readonly checks: ChecksRepository,
    private readonly markets: MarketRegistry,
    @Inject(CHECK_INTEGRATIONS) private readonly integrations: readonly CheckIntegration[],
  ) {}

  async developerSemaphore(manager: EntityManager, developer: Developer, now = new Date()): Promise<SemaphoreResult> {
    const definitions = this.definitionsFor(developer.market, 'DEVELOPER');
    const latest = await this.checks.latestForDeveloper(manager, developer.id);
    return buildSemaphore(definitions, latest, now);
  }

  async projectSemaphore(manager: EntityManager, project: Project, developer: Developer, now = new Date()): Promise<ProjectSemaphore> {
    const definitions = this.definitionsFor(project.market, 'PROJECT');
    const latest = await this.checks.latestForProject(manager, project.id);
    const projectResult = buildSemaphore(definitions, latest, now);
    const developerResult = await this.developerSemaphore(manager, developer, now);
    return {
      developer: developerResult,
      project: projectResult,
      overall: worstOf([developerResult.overall, projectResult.overall]),
      hardBlocked: developerResult.hardBlocked || projectResult.hardBlocked,
      containsDummyData: developerResult.containsDummyData || projectResult.containsDummyData,
    };
  }

  definitionsFor(market: MarketCode, subject: CheckSubject): CheckDefinition[] {
    return this.markets.get(market).checks.filter((check) => check.subject === subject);
  }

  /**
   * Spoljni izvori za automatske provere (u MVP-u DUMMY). Ne otvara konekciju
   * ka bazi i ne sme se zvati unutar transakcije. Izvor koji ne odgovori daje
   * sivu stavku, a greška ide samo u log.
   */
  async fetchAutomatic(
    market: MarketCode,
    subject: CheckSubject,
    input: IntegrationInput,
    options: { onlyFreeSemaphore: boolean },
  ): Promise<AutomaticCheckResult[]> {
    const definitions = this.definitionsFor(market, subject).filter(
      (definition) => definition.integration && (!options.onlyFreeSemaphore || definition.inFreeSemaphore),
    );
    const results: AutomaticCheckResult[] = [];
    for (const definition of definitions) {
      const integration = this.integrations.find((candidate) => candidate.key === definition.integration);
      if (!integration) continue;
      try {
        results.push({ definition, result: await integration.run(input) });
      } catch (error) {
        this.logger.warn(`Izvor ${definition.integration} nije odgovorio.`, error instanceof Error ? error.stack : undefined);
        results.push({
          definition,
          result: {
            status: 'GRAY',
            summary: 'Izvor trenutno nije dostupan.',
            source: String(definition.integration),
            dummy: false,
            fetchedAt: new Date(),
            data: {},
          },
        });
      }
    }
    return results;
  }

  /** Upisuje rezultate automatskih provera (učestvuje u transakciji vlasnika). */
  /** Upisuje rezultate i vraća izmene za audit (`check.KOD`: prethodni → novi status). */
  async recordAutomatic(
    manager: EntityManager,
    market: MarketCode,
    target: { developerId: string | null; projectId: string | null },
    results: readonly AutomaticCheckResult[],
  ): Promise<Record<string, AuditChange>> {
    const previous = await this.latestStatuses(manager, target);
    await this.checks.insertMany(manager, results.map((item) => this.toNewCheck(market, target, item)));
    return checkStatusChanges(
      previous,
      results.map((item) => ({ code: item.definition.code, status: item.result.status })),
    );
  }

  /** Poslednji status po kodu provere za investitora ili projekat (pre novog upisa, za audit). */
  async latestStatuses(manager: EntityManager, target: { developerId: string | null; projectId: string | null }): Promise<Map<string, string>> {
    const latest = target.developerId
      ? await this.checks.latestForDeveloper(manager, target.developerId)
      : target.projectId
        ? await this.checks.latestForProject(manager, target.projectId)
        : [];
    return new Map(latest.map((check) => [check.definitionCode, check.status]));
  }

  /**
   * Semafor iz rezultata koji nisu upisani u bazu (besplatna provera za
   * investitora koji nije u katalogu, F-35).
   */
  semaphoreFromResults(market: MarketCode, results: readonly AutomaticCheckResult[], now = new Date()): SemaphoreResult {
    const checks = results.map((item, index) => ({
      ...this.toNewCheck(market, { developerId: null, projectId: null }, item),
      id: `unsaved-${index}`,
      createdAt: now,
    })) as Check[];
    return buildSemaphore(
      results.map((item) => item.definition),
      checks,
      now,
    );
  }

  validUntil(definition: CheckDefinition, checkedAt: Date): Date {
    return new Date(checkedAt.getTime() + definition.validityDays * DAY_MS);
  }

  private toNewCheck(
    market: MarketCode,
    target: { developerId: string | null; projectId: string | null },
    item: AutomaticCheckResult,
  ): NewCheck {
    const checkedAt = item.result.fetchedAt;
    return {
      market,
      subjectType: item.definition.subject,
      developerId: target.developerId,
      projectId: target.projectId,
      definitionCode: item.definition.code,
      status: item.result.status,
      summary: item.result.summary.slice(0, 500),
      source: item.result.source.slice(0, 300),
      method: 'AUTOMATIC',
      dummy: item.result.dummy,
      checkedAt,
      validUntil: this.validUntil(item.definition, checkedAt),
      checkedById: null,
      documentId: null,
      data: item.result.data,
    };
  }
}
