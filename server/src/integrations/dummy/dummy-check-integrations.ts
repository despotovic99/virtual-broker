/*
 * =============================================================================
 *  DUMMY INTEGRACIJE — OVO NISU PRAVI PODACI.
 *  TODO(integracija): svaku klasu zameniti pravom integracijom pre lansiranja.
 * =============================================================================
 *
 * Rezultat se računa iz unetog broja, da bi se u testiranju mogle dobiti sve
 * boje semafora:
 *   - matični/HE broj koji se završava na 0 → CRVENO
 *   - završava na 5 → ŽUTO
 *   - prazan broj → SIVO (nije provereno)
 *   - ostalo → ZELENO
 *
 * Svaki rezultat ima `dummy: true` i izvor koji počinje sa „DUMMY:”, pa ga
 * klijent prikazuje sa oznakom „test podatak”.
 */
import { Injectable } from '@nestjs/common';
import { IntegrationKey } from '../integration-key.js';
import type { CheckIntegration, IntegrationInput, IntegrationResult, SemaphoreStatus } from '../integration.types.js';

function statusFor(value: string | null | undefined): SemaphoreStatus {
  const trimmed = value?.trim();
  if (!trimmed) return 'GRAY';
  const last = trimmed[trimmed.length - 1];
  if (last === '0') return 'RED';
  if (last === '5') return 'YELLOW';
  return 'GREEN';
}

function dummyResult(
  status: SemaphoreStatus,
  source: string,
  summaries: Record<SemaphoreStatus, string>,
  data: IntegrationResult['data'],
): IntegrationResult {
  return { status, summary: summaries[status], source: `DUMMY: ${source}`, dummy: true, fetchedAt: new Date(), data };
}

/**
 * DUMMY — Srbija, APR (status firme).
 * TODO(integracija): APR veb-servis (ugovor sa APR-om, apr-podaci@apr.gov.rs):
 * status, osnivači, zastupnici, praćenje promena. Dokument 7, odeljak Srbija.
 */
@Injectable()
export class DummyRsAprCompanyIntegration implements CheckIntegration {
  readonly key = IntegrationKey.RsAprCompany;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const status = statusFor(input.registrationNumber);
    return Promise.resolve(
      dummyResult(
        status,
        'APR — integracija nije urađena',
        {
          GREEN: 'Firma je aktivna.',
          YELLOW: 'Firma je aktivna, ali je skoro menjala vlasnike.',
          RED: 'Firma je u likvidaciji ili stečaju.',
          GRAY: 'Matični broj nije unet.',
        },
        { registrationNumber: input.registrationNumber ?? null, companyStatus: status === 'RED' ? 'U likvidaciji' : 'Aktivno' },
      ),
    );
  }
}

/**
 * DUMMY — Srbija, NBS (blokada računa).
 * TODO(integracija): NBS veb-servis registra dužnika u prinudnoj naplati
 * (≈4 RSD po matičnom broju, najmanje 100 po upitu). Dnevna provera.
 */
@Injectable()
export class DummyRsNbsBlockadeIntegration implements CheckIntegration {
  readonly key = IntegrationKey.RsNbsBlockade;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const status = statusFor(input.registrationNumber);
    return Promise.resolve(
      dummyResult(
        status,
        'NBS prinudna naplata — integracija nije urađena',
        {
          GREEN: 'Račun nije u blokadi.',
          YELLOW: 'Račun je bio u blokadi u poslednjih 12 meseci.',
          RED: 'Račun je trenutno u blokadi.',
          GRAY: 'Matični broj nije unet.',
        },
        { registrationNumber: input.registrationNumber ?? null, blockedNow: status === 'RED' },
      ),
    );
  }
}

/**
 * DUMMY — Srbija, Poreska uprava (spisak najvećih poreskih dužnika).
 * TODO(integracija): uvoz godišnjeg spiska sa purs.gov.rs pri objavi.
 */
@Injectable()
export class DummyRsTaxDebtorsIntegration implements CheckIntegration {
  readonly key = IntegrationKey.RsTaxDebtors;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const raw = statusFor(input.registrationNumber);
    const status: SemaphoreStatus = raw === 'YELLOW' ? 'GREEN' : raw;
    return Promise.resolve(
      dummyResult(
        status,
        'Poreska uprava, spisak dužnika — integracija nije urađena',
        {
          GREEN: 'Firma nije na spisku najvećih poreskih dužnika.',
          YELLOW: '',
          RED: 'Firma je na spisku najvećih poreskih dužnika.',
          GRAY: 'Matični broj nije unet.',
        },
        { registrationNumber: input.registrationNumber ?? null },
      ),
    );
  }
}

/**
 * DUMMY — Kipar, Registrar of Companies.
 * TODO(integracija): mesečni CSV sa data.gov.cy (CC BY 4.0: firme, status,
 * direktori) i po potrebi plaćena pretraga (10 €) ili posrednik sa API-jem.
 */
@Injectable()
export class DummyCyRegistrarCompanyIntegration implements CheckIntegration {
  readonly key = IntegrationKey.CyRegistrarCompany;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const status = statusFor(input.registrationNumber);
    return Promise.resolve(
      dummyResult(
        status,
        'Registrar of Companies — integracija nije urađena',
        {
          GREEN: 'Company is active.',
          YELLOW: 'Company is active, annual return overdue.',
          RED: 'Company is struck off or dissolved.',
          GRAY: 'HE number missing.',
        },
        { registrationNumber: input.registrationNumber ?? null },
      ),
    );
  }
}

/**
 * DUMMY — Kipar, Department of Insolvency.
 * TODO(integracija): pretraga registra likvidacija na insolvency.gov.cy (nema API).
 */
@Injectable()
export class DummyCyInsolvencyIntegration implements CheckIntegration {
  readonly key = IntegrationKey.CyInsolvency;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const raw = statusFor(input.registrationNumber);
    const status: SemaphoreStatus = raw === 'YELLOW' ? 'GREEN' : raw;
    return Promise.resolve(
      dummyResult(
        status,
        'Department of Insolvency — integracija nije urađena',
        {
          GREEN: 'Company is not in the liquidation register.',
          YELLOW: '',
          RED: 'Company is in the liquidation register.',
          GRAY: 'HE number missing.',
        },
        { registrationNumber: input.registrationNumber ?? null },
      ),
    );
  }
}

/**
 * DUMMY — Kipar, DLS WFS (podaci o parceli).
 * TODO(integracija): eservices.dls.moi.gov.cy WFS (besplatno): broj parcele,
 * geometrija, površina, zona. Vlasnik i tereti NISU u ovom izvoru.
 */
@Injectable()
export class DummyCyDlsParcelIntegration implements CheckIntegration {
  readonly key = IntegrationKey.CyDlsParcel;

  run(input: IntegrationInput): Promise<IntegrationResult> {
    const status: SemaphoreStatus = input.parcelReference?.trim() ? 'GREEN' : 'GRAY';
    return Promise.resolve(
      dummyResult(
        status,
        'DLS WFS — integracija nije urađena',
        {
          GREEN: 'Parcela postoji u katastru (bez podataka o vlasniku i teretima).',
          YELLOW: '',
          RED: '',
          GRAY: 'Oznaka parcele nije uneta.',
        },
        { parcelReference: input.parcelReference ?? null, zone: status === 'GREEN' ? 'Residential (dummy)' : null },
      ),
    );
  }
}

export const DUMMY_CHECK_INTEGRATIONS = [
  DummyRsAprCompanyIntegration,
  DummyRsNbsBlockadeIntegration,
  DummyRsTaxDebtorsIntegration,
  DummyCyRegistrarCompanyIntegration,
  DummyCyInsolvencyIntegration,
  DummyCyDlsParcelIntegration,
] as const;
