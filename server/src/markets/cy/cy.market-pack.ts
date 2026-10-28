import { Role } from '../../core/access/role.enum.js';
import { IntegrationKey } from '../../integrations/integration-key.js';
import { COMMON_DOCUMENT_TYPES } from '../common-document-types.js';
import {
  JourneyPhase,
  type BuyerProfileFacts,
  type CostBreakdown,
  type CostInput,
  type CostLine,
  type LegalFinding,
  type MarketPack,
} from '../market-pack.js';

const P = JourneyPhase;
const { Analyst, Lawyer, Engineer, Buyer } = Role;

/**
 * Paket tržišta: Kipar. Koraci K1–K17 iz dokumenta 6 (novogradnja od developera).
 * Novac: model ESCROW (escrow partner čuva novac i isplaćuje po instrukciji).
 */
export const cyMarketPack: MarketPack = {
  code: 'CY',
  version: 'CY-0.2',
  locale: { languages: ['en', 'sr-Latn'], displayCurrencies: ['EUR'], timeZone: 'Europe/Nicosia' },
  moneyModel: 'ESCROW',

  journey: [
    { code: 'K1', phase: P.Preparation, title: { sr: 'Odluka, budžet i status kupca', en: 'Decision, budget and buyer status' }, ownerRoles: [Buyer] },
    { code: 'K2', phase: P.Preparation, title: { sr: 'Nezavisni advokat i punomoćje', en: 'Independent lawyer and power of attorney' }, ownerRoles: [Lawyer] },
    { code: 'K3', phase: P.Preparation, title: { sr: 'Poreski broj, bankovni račun i AML provera', en: 'Tax number, bank account and AML check' }, ownerRoles: [Lawyer] },
    { code: 'K4', phase: P.Preparation, title: { sr: 'Izbor projekta i provera agenta', en: 'Project choice and agent check' }, ownerRoles: [Buyer, Analyst] },
    { code: 'K5', phase: P.Checks, title: { sr: 'Pravna provera (due diligence)', en: 'Due diligence' }, ownerRoles: [Lawyer, Analyst] },
    { code: 'K6', phase: P.Contract, title: { sr: 'Rezervacija i depozit', en: 'Reservation and deposit' }, ownerRoles: [] },
    { code: 'K7', phase: P.Contract, title: { sr: 'Pregovori i potpis ugovora', en: 'Negotiation and contract signing' }, ownerRoles: [Lawyer], requiresLegalOpinion: true },
    { code: 'K8', phase: P.Contract, title: { sr: 'Stopa PDV-a: 19% ili prijava za 5%', en: 'VAT rate: 19% or 5% application' }, ownerRoles: [Lawyer] },
    { code: 'K9', phase: P.Contract, title: { sr: 'Deponovanje ugovora u Land Registry', en: 'Contract deposit at the Land Registry' }, ownerRoles: [Lawyer] },
    { code: 'K10', phase: P.Contract, title: { sr: 'Dozvola Saveta ministara (kupci van EU)', en: 'Council of Ministers permit (non-EU buyers)' }, ownerRoles: [Lawyer], optional: true },
    { code: 'K11', phase: P.PaymentsConstruction, title: { sr: 'Plaćanja po fazama', en: 'Staged payments' }, ownerRoles: [] },
    { code: 'K12', phase: P.PaymentsConstruction, title: { sr: 'Praćenje gradnje', en: 'Construction monitoring' }, ownerRoles: [Engineer] },
    { code: 'K13', phase: P.Completion, title: { sr: 'Završni sertifikat, pregled i poslednja uplata', en: 'Final approval, snagging and final payment' }, ownerRoles: [Engineer, Lawyer] },
    { code: 'K14', phase: P.Completion, title: { sr: 'Primopredaja, ključevi, struja i voda', en: 'Handover, keys, electricity and water' }, ownerRoles: [Engineer] },
    { code: 'K15', phase: P.AfterKeys, title: { sr: 'Izdavanje zasebnih title deed-ova', en: 'Issue of separate title deeds' }, ownerRoles: [Lawyer] },
    { code: 'K16', phase: P.AfterKeys, title: { sr: 'Prenos vlasništva na kupca', en: 'Transfer of title to the buyer' }, ownerRoles: [Lawyer] },
    { code: 'K17', phase: P.AfterKeys, title: { sr: 'Tekući troškovi vlasnika', en: 'Ongoing owner costs' }, ownerRoles: [Buyer], optional: true },
  ],

  checks: [
    // Developer (F-05)
    { code: 'CY_REGISTRAR_STATUS', subject: 'DEVELOPER', title: { sr: 'Status firme (Registrar of Companies)', en: 'Company status (Registrar of Companies)' }, mandatory: true, method: 'AUTOMATIC', validityDays: 30, integration: IntegrationKey.CyRegistrarCompany, inFreeSemaphore: true },
    { code: 'CY_INSOLVENCY', subject: 'DEVELOPER', title: { sr: 'Registar likvidacija', en: 'Liquidation register' }, mandatory: true, method: 'AUTOMATIC', validityDays: 7, integration: IntegrationKey.CyInsolvency, inFreeSemaphore: true },
    { code: 'CY_COURT_CASES', subject: 'DEVELOPER', title: { sr: 'Sudski sporovi (pretraga advokata)', en: 'Court cases (lawyer search)' }, mandatory: false, method: 'LAWYER', validityDays: 90, inFreeSemaphore: false },
    { code: 'CY_TITLE_TRACK_RECORD', subject: 'DEVELOPER', title: { sr: 'Istorija title deed-ova u ranijim projektima', en: 'Title deed track record' }, mandatory: false, method: 'MANUAL', validityDays: 365, inFreeSemaphore: false },
    // Projekat (F-06)
    { code: 'CY_PARCEL_DATA', subject: 'PROJECT', title: { sr: 'Podaci o parceli (DLS)', en: 'Plot data (DLS)' }, mandatory: false, method: 'AUTOMATIC', validityDays: 365, integration: IntegrationKey.CyDlsParcel, inFreeSemaphore: true },
    { code: 'CY_SEARCH_CERTIFICATE', subject: 'PROJECT', title: { sr: 'Vlasnik i tereti (search certificate)', en: 'Owner and encumbrances (search certificate)' }, mandatory: true, method: 'DOCUMENT', validityDays: 30, inFreeSemaphore: false },
    { code: 'CY_PERMITS', subject: 'PROJECT', title: { sr: 'Planning i building permit', en: 'Planning and building permits' }, mandatory: true, method: 'DOCUMENT', validityDays: 180, inFreeSemaphore: false },
    { code: 'CY_FORM_A', subject: 'PROJECT', title: { sr: 'Hipoteka i Form A (Form C se ne prihvata)', en: 'Mortgage and Form A (Form C not accepted)' }, mandatory: true, method: 'LAWYER', validityDays: 180, inFreeSemaphore: false, hardBlockOnRed: true },
    { code: 'CY_NORTH_LOCATION', subject: 'PROJECT', title: { sr: 'Lokacija van okupiranog severa', en: 'Location outside the occupied north' }, mandatory: true, method: 'MANUAL', validityDays: 3650, inFreeSemaphore: false, hardBlockOnRed: true },
  ],

  paymentConditions: [
    { code: 'CY_CONTRACT_DEPOSITED', title: { sr: 'Ugovor deponovan u Land Registry', en: 'Contract deposited at the Land Registry' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer] },
    { code: 'CY_FORM_A', title: { sr: 'Form A potpisan ili nema hipoteke', en: 'Form A signed or no mortgage' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer] },
    { code: 'CY_PERMITS', title: { sr: 'Dozvole proverene', en: 'Permits verified' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer, Analyst] },
    { code: 'CY_ACCOUNT_VERIFIED', title: { sr: 'Račun primaoca proveren', en: 'Recipient account verified' }, appliesTo: 'EVERY', confirmerRoles: [Analyst] },
    { code: 'CY_PHASE_CONFIRMED', title: { sr: 'Inženjer potvrdio fazu gradnje', en: 'Engineer confirmed the construction phase' }, appliesTo: 'PHASE', confirmerRoles: [Engineer] },
    { code: 'CY_FINAL_APPROVAL', title: { sr: 'Certificate of Final Approval izdat', en: 'Certificate of Final Approval issued' }, appliesTo: 'LAST', confirmerRoles: [Lawyer] },
  ],

  constructionPhases: [
    { code: 'FOUNDATION', title: { sr: 'Temelji', en: 'Foundations' }, defaultSharePercent: 20 },
    { code: 'STRUCTURE', title: { sr: 'Konstrukcija', en: 'Structure' }, defaultSharePercent: 30 },
    { code: 'ROOF', title: { sr: 'Krov', en: 'Roof' }, defaultSharePercent: 10 },
    { code: 'FACADE_INSTALLATIONS', title: { sr: 'Fasada i instalacije', en: 'Facade and installations' }, defaultSharePercent: 20 },
    { code: 'FINISHING', title: { sr: 'Završni radovi', en: 'Finishing works' }, defaultSharePercent: 10 },
    { code: 'FINAL_APPROVAL', title: { sr: 'Certificate of Final Approval', en: 'Certificate of Final Approval' }, defaultSharePercent: 10 },
  ],

  documentTypes: [
    ...COMMON_DOCUMENT_TYPES,
    { code: 'CY_SEARCH_CERTIFICATE', title: { sr: 'Search certificate (izvod sa teretima)', en: 'Search certificate with encumbrances' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'CY_TITLE_DEED', title: { sr: 'Title deed', en: 'Title deed' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'CY_PLANNING_PERMIT', title: { sr: 'Planning permit', en: 'Planning permit' }, scopes: ['PROJECT'] },
    { code: 'CY_BUILDING_PERMIT', title: { sr: 'Building permit', en: 'Building permit' }, scopes: ['PROJECT'] },
    { code: 'CY_FORM_A', title: { sr: 'Form A (obaveza banke)', en: 'Form A (bank undertaking)' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'CY_CONTRACT_DEPOSIT', title: { sr: 'Potvrda o deponovanju ugovora', en: 'Contract deposit receipt' }, scopes: ['PURCHASE'] },
    { code: 'CY_CAP109_PERMIT', title: { sr: 'Dozvola po Cap. 109', en: 'Cap. 109 permit' }, scopes: ['PURCHASE'] },
    { code: 'CY_FINAL_APPROVAL', title: { sr: 'Certificate of Final Approval', en: 'Certificate of Final Approval' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'CY_VAT_DECLARATION', title: { sr: 'Prijava za PDV 5%', en: 'Reduced 5% VAT application' }, scopes: ['PURCHASE'] },
  ],

  calculateCosts: calculateCyCosts,
  legalFindings: cyLegalFindings,
};

/**
 * Troškovi za Kipar (F-10, dokument 6). Cena je bez PDV-a. Taksa na ugovor
 * (stamp duty) je ukinuta za ugovore od 1.1.2026. Prenosna taksa se ne plaća
 * kada je plaćen PDV. Iznosi su procene.
 */
function calculateCyCosts(input: CostInput): CostBreakdown {
  const lines: CostLine[] = [];
  const reducedEligible = input.primaryResidence && input.area <= 190 && input.price <= 475_000;
  let vat: number;
  if (reducedEligible) {
    const reducedShare = input.area > 0 ? Math.min(1, 130 / input.area) : 0;
    const reducedBase = input.price <= 350_000 ? input.price * reducedShare : 0;
    vat = Math.round(reducedBase * 0.05 + (input.price - reducedBase) * 0.19);
  } else {
    vat = Math.round(input.price * 0.19);
  }
  lines.push({
    code: 'VAT',
    label: reducedEligible
      ? { sr: 'PDV (5% na prvih 130 m², ostatak 19%)', en: 'VAT (5% on the first 130 m², rest 19%)' }
      : { sr: 'PDV 19%', en: 'VAT 19%' },
    amount: vat,
    kind: 'COST',
    estimate: reducedEligible,
    note: reducedEligible
      ? { sr: 'Samo za stan koji je glavno prebivalište 10 godina; prijava se podnosi pre useljenja.', en: 'Only for a main residence for 10 years; apply before moving in.' }
      : undefined,
  });
  lines.push({
    code: 'STAMP_DUTY',
    label: { sr: 'Taksa na ugovor (ukinuta od 1.1.2026)', en: 'Stamp duty (abolished from 1 Jan 2026)' },
    amount: 0,
    kind: 'COST',
    estimate: false,
  });
  lines.push({
    code: 'TRANSFER_FEE',
    label: { sr: 'Prenosna taksa (ne plaća se uz PDV)', en: 'Transfer fee (not due when VAT is paid)' },
    amount: 0,
    kind: 'COST',
    estimate: false,
  });
  lines.push({
    code: 'LAWYER',
    label: { sr: 'Advokat (paušal)', en: 'Lawyer (flat fee)' },
    amount: 1_200,
    kind: 'COST',
    estimate: true,
    note: { sr: 'Ko plaća advokata zavisi od poslovnog modela (README O1, Q24).', en: 'Who pays the lawyer depends on the business model (README O1, Q24).' },
  });
  lines.push({
    code: 'LAND_REGISTRY',
    label: { sr: 'Search certificate i deponovanje ugovora', en: 'Search certificate and contract deposit' },
    amount: 60,
    kind: 'COST',
    estimate: true,
  });
  if (input.loanAmount > 0) {
    lines.push({
      code: 'MORTGAGE_REGISTRATION',
      label: { sr: 'Upis hipoteke (1% kredita) i procena banke', en: 'Mortgage registration (1% of loan) and bank valuation' },
      amount: Math.round(input.loanAmount * 0.01) + 360,
      kind: 'COST',
      estimate: true,
    });
  }
  const totalExtra = lines.filter((line) => line.kind === 'COST').reduce((sum, line) => sum + line.amount, 0);
  return {
    lines,
    totalExtra,
    totalRefund: 0,
    disclaimer: {
      sr: 'Procena. Tačne iznose daju advokat, DLS i Poreska uprava Kipra.',
      en: 'Estimate. Exact amounts come from the lawyer, the DLS and the Cyprus Tax Department.',
    },
  };
}

function cyLegalFindings(profile: BuyerProfileFacts): LegalFinding[] {
  const findings: LegalFinding[] = [];
  if (!profile.isEuCitizen) {
    findings.push({
      code: 'CY_CAP109',
      level: 'WARNING',
      title: { sr: 'Dozvola za kupce van EU (Cap. 109)', en: 'Permit for non-EU buyers (Cap. 109)' },
      text: {
        sr: 'Kao kupac van EU treba vam dozvola Saveta ministara. Advokat je podnosi posle potpisa; bez nje nema prenosa vlasništva.',
        en: 'As a non-EU buyer you need a Council of Ministers permit. Your lawyer files it after signing; title cannot be transferred without it.',
      },
    });
  }
  if (profile.primaryResidence) {
    findings.push({
      code: 'CY_REDUCED_VAT',
      level: 'INFO',
      title: { sr: 'PDV od 5%', en: 'Reduced 5% VAT' },
      text: {
        sr: 'Za glavno prebivalište možete imati PDV od 5% na prvih 130 m² (stan do 190 m² i 475.000 €). Uslov je stanovanje 10 godina.',
        en: 'For a main residence you may get 5% VAT on the first 130 m² (unit up to 190 m² and €475,000). You must live there for 10 years.',
      },
    });
  }
  if (profile.financing === 'MORTGAGE' && !profile.isEuCitizen) {
    findings.push({
      code: 'CY_NON_EU_MORTGAGE',
      level: 'WARNING',
      title: { sr: 'Kredit za kupce van EU', en: 'Mortgage for non-EU buyers' },
      text: {
        sr: 'Kiparske banke retko odobravaju kredit kupcima van EU bez boravka na Kipru. Računajte na kupovinu iz sopstvenih sredstava.',
        en: 'Cypriot banks rarely lend to non-EU buyers without Cyprus residence. Plan to buy with your own funds.',
      },
    });
  }
  return findings;
}
