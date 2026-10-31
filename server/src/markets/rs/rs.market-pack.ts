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
 * Paket tržišta: Srbija. Koraci S1–S17 iz dokumenta 6 (novogradnja od investitora).
 * Novac: model GATE (kupac plaća investitoru, svaka rata zaključana uslovima; Q27).
 */
export const rsMarketPack: MarketPack = {
  code: 'RS',
  version: 'RS-0.2',
  locale: { languages: ['sr-Latn', 'en'], displayCurrencies: ['EUR', 'RSD'], timeZone: 'Europe/Belgrade' },
  moneyModel: 'GATE',

  journey: [
    { code: 'S1', phase: P.Preparation, title: { sr: 'Odluka, budžet i status kupca', en: 'Decision, budget and buyer status' }, ownerRoles: [Buyer] },
    { code: 'S2', phase: P.Preparation, title: { sr: 'Izbor projekta i stana', en: 'Choosing the project and unit' }, ownerRoles: [Buyer] },
    { code: 'S3', phase: P.Checks, title: { sr: 'Provera investitora', en: 'Developer check' }, ownerRoles: [Analyst, Lawyer] },
    { code: 'S4', phase: P.Checks, title: { sr: 'Provera projekta i parcele', en: 'Project and plot check' }, ownerRoles: [Analyst, Lawyer] },
    { code: 'S5', phase: P.Contract, title: { sr: 'Rezervacija i kapara', en: 'Reservation and deposit' }, ownerRoles: [] },
    { code: 'S6', phase: P.Contract, title: { sr: 'Pregled ugovora i pravno mišljenje', en: 'Contract review and legal opinion' }, ownerRoles: [Lawyer], requiresLegalOpinion: true },
    { code: 'S7', phase: P.Contract, title: { sr: 'Overa ugovora kod javnog beležnika', en: 'Contract notarisation' }, ownerRoles: [Lawyer], requiresLegalOpinion: true },
    { code: 'S8', phase: P.Contract, title: { sr: 'Predbeležba u katastru', en: 'Pre-registration in the cadastre' }, ownerRoles: [Lawyer] },
    { code: 'S9', phase: P.PaymentsConstruction, title: { sr: 'Plaćanja po fazama', en: 'Staged payments' }, ownerRoles: [] },
    { code: 'S10', phase: P.PaymentsConstruction, title: { sr: 'Praćenje gradnje', en: 'Construction monitoring' }, ownerRoles: [Engineer] },
    { code: 'S11', phase: P.Completion, title: { sr: 'Tehnički pregled, upotrebna dozvola i etažiranje', en: 'Technical inspection, use permit, unit registration' }, ownerRoles: [Lawyer] },
    { code: 'S12', phase: P.Completion, title: { sr: 'Primopredaja, poslednja rata i ključevi', en: 'Handover, final instalment and keys' }, ownerRoles: [Engineer] },
    { code: 'S13', phase: P.AfterKeys, title: { sr: 'Uknjižba vlasništva', en: 'Title registration' }, ownerRoles: [Lawyer] },
    { code: 'S14', phase: P.AfterKeys, title: { sr: 'Povraćaj PDV-a za prvi stan', en: 'First-home VAT refund' }, ownerRoles: [Lawyer], optional: true },
    { code: 'S15', phase: P.AfterKeys, title: { sr: 'Porez na imovinu', en: 'Property tax' }, ownerRoles: [], optional: true },
    { code: 'S16', phase: P.AfterKeys, title: { sr: 'Komunalije, prebivalište i stambena zajednica', en: 'Utilities, residence and building association' }, ownerRoles: [Buyer], optional: true },
    { code: 'S17', phase: P.AfterKeys, title: { sr: 'Garantni rok i reklamacije', en: 'Warranty and defect claims' }, ownerRoles: [Engineer], optional: true },
  ],

  checks: [
    // Investitor (F-05)
    { code: 'RS_APR_STATUS', subject: 'DEVELOPER', title: { sr: 'Status firme u APR-u', en: 'Company status (APR)' }, mandatory: true, method: 'AUTOMATIC', validityDays: 7, integration: IntegrationKey.RsAprCompany, inFreeSemaphore: true, hardBlockOnRed: true },
    { code: 'RS_NBS_BLOCKADE', subject: 'DEVELOPER', title: { sr: 'Blokada računa (NBS)', en: 'Account blockade (NBS)' }, mandatory: true, method: 'AUTOMATIC', validityDays: 1, integration: IntegrationKey.RsNbsBlockade, inFreeSemaphore: true, hardBlockOnRed: true },
    { code: 'RS_TAX_DEBT', subject: 'DEVELOPER', title: { sr: 'Spisak poreskih dužnika', en: 'Tax debtors list' }, mandatory: false, method: 'AUTOMATIC', validityDays: 365, integration: IntegrationKey.RsTaxDebtors, inFreeSemaphore: true },
    { code: 'RS_FINANCIALS', subject: 'DEVELOPER', title: { sr: 'Finansijski izveštaji', en: 'Financial statements' }, mandatory: false, method: 'MANUAL', validityDays: 365, inFreeSemaphore: false },
    { code: 'RS_COURT_CASES', subject: 'DEVELOPER', title: { sr: 'Sudski sporovi i izvršenja', en: 'Court cases and enforcement' }, mandatory: false, method: 'LAWYER', validityDays: 90, inFreeSemaphore: false },
    { code: 'RS_TRACK_RECORD', subject: 'DEVELOPER', title: { sr: 'Raniji projekti i uknjižbe kupaca', en: 'Past projects and buyer registrations' }, mandatory: false, method: 'MANUAL', validityDays: 365, inFreeSemaphore: false },
    // Projekat i parcela (F-06)
    { code: 'RS_PARCEL_OWNERSHIP', subject: 'PROJECT', title: { sr: 'Vlasništvo i udeo na parceli (izvod iz lista nepokretnosti)', en: 'Plot ownership and share (property sheet)' }, mandatory: true, method: 'DOCUMENT', validityDays: 30, inFreeSemaphore: false },
    { code: 'RS_ENCUMBRANCES', subject: 'PROJECT', title: { sr: 'Hipoteke, zabeležbe i zabrane', en: 'Mortgages, notes and prohibitions' }, mandatory: true, method: 'DOCUMENT', validityDays: 30, inFreeSemaphore: false },
    { code: 'RS_BUILDING_PERMIT', subject: 'PROJECT', title: { sr: 'Građevinska dozvola (CEOP)', en: 'Building permit (CEOP)' }, mandatory: true, method: 'DOCUMENT', validityDays: 180, inFreeSemaphore: false },
    { code: 'RS_WORKS_NOTICE', subject: 'PROJECT', title: { sr: 'Prijava radova', en: 'Notice of works' }, mandatory: true, method: 'DOCUMENT', validityDays: 180, inFreeSemaphore: false },
    { code: 'RS_BANK_RELEASE', subject: 'PROJECT', title: { sr: 'Pismo banke o puštanju hipoteke', en: 'Bank mortgage release letter' }, mandatory: false, method: 'DOCUMENT', validityDays: 180, inFreeSemaphore: false },
  ],

  paymentConditions: [
    { code: 'RS_CONTRACT_NOTARIZED', title: { sr: 'Ugovor overen kod javnog beležnika', en: 'Contract notarised' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer] },
    { code: 'RS_PERMIT_AND_NOTICE', title: { sr: 'Građevinska dozvola i prijava radova provereni', en: 'Building permit and notice of works verified' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer, Analyst] },
    { code: 'RS_PRE_REGISTRATION', title: { sr: 'Predbeležba kupca upisana u katastar', en: 'Buyer pre-registration recorded' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer] },
    { code: 'RS_MORTGAGE_CLEAR', title: { sr: 'Nema ranije hipoteke ili postoji pismo banke', en: 'No prior mortgage or bank release letter' }, appliesTo: 'FIRST', confirmerRoles: [Lawyer] },
    { code: 'RS_ACCOUNT_VERIFIED', title: { sr: 'Račun investitora proveren', en: 'Developer account verified' }, appliesTo: 'EVERY', confirmerRoles: [Analyst] },
    { code: 'RS_PHASE_CONFIRMED', title: { sr: 'Inženjer potvrdio fazu gradnje', en: 'Engineer confirmed the construction phase' }, appliesTo: 'PHASE', confirmerRoles: [Engineer] },
    { code: 'RS_USE_PERMIT', title: { sr: 'Upotrebna dozvola izdata', en: 'Use permit issued' }, appliesTo: 'LAST', confirmerRoles: [Lawyer] },
  ],

  constructionPhases: [
    { code: 'FOUNDATION', title: { sr: 'Temelji', en: 'Foundations' }, defaultSharePercent: 20 },
    { code: 'STRUCTURE', title: { sr: 'Konstrukcija', en: 'Structure' }, defaultSharePercent: 30 },
    { code: 'ROOF', title: { sr: 'Krov', en: 'Roof' }, defaultSharePercent: 10 },
    { code: 'FACADE_INSTALLATIONS', title: { sr: 'Fasada i instalacije', en: 'Facade and installations' }, defaultSharePercent: 20 },
    { code: 'FINISHING', title: { sr: 'Završni radovi', en: 'Finishing works' }, defaultSharePercent: 10 },
    { code: 'USE_PERMIT', title: { sr: 'Upotrebna dozvola', en: 'Use permit' }, defaultSharePercent: 10 },
  ],

  documentTypes: [
    ...COMMON_DOCUMENT_TYPES,
    { code: 'RS_PROPERTY_SHEET', title: { sr: 'Izvod iz lista nepokretnosti', en: 'Property sheet extract' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'RS_BUILDING_PERMIT', title: { sr: 'Građevinska dozvola', en: 'Building permit' }, scopes: ['PROJECT'] },
    { code: 'RS_WORKS_NOTICE', title: { sr: 'Prijava radova', en: 'Notice of works' }, scopes: ['PROJECT'] },
    { code: 'RS_BANK_RELEASE_LETTER', title: { sr: 'Pismo banke o puštanju hipoteke', en: 'Bank release letter' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'RS_PRE_REGISTRATION', title: { sr: 'Rešenje o predbeležbi', en: 'Pre-registration decision' }, scopes: ['PURCHASE'] },
    { code: 'RS_USE_PERMIT', title: { sr: 'Upotrebna dozvola', en: 'Use permit' }, scopes: ['PROJECT', 'PURCHASE'] },
    { code: 'RS_TITLE_DECISION', title: { sr: 'Rešenje o uknjižbi', en: 'Title registration decision' }, scopes: ['PURCHASE'] },
    { code: 'RS_FISCAL_INVOICE', title: { sr: 'Fiskalni račun', en: 'Fiscal invoice' }, scopes: ['PURCHASE'] },
    { code: 'RS_VAT_REFUND_REQUEST', title: { sr: 'Zahtev za povraćaj PDV-a', en: 'VAT refund request' }, scopes: ['PURCHASE'] },
  ],

  calculateCosts: calculateRsCosts,
  legalFindings: rsLegalFindings,
};

/**
 * Troškovi za Srbiju (F-10, dokument 6). Iznosi su procene i služe za
 * orijentaciju; tačan obračun daju beležnik, RGZ, banka i Poreska uprava.
 */
function calculateRsCosts(input: CostInput): CostBreakdown {
  const lines: CostLine[] = [];
  const vatIncluded = Math.round((input.price * 10) / 110);
  lines.push({
    code: 'VAT_INCLUDED',
    label: { sr: 'PDV 10% (uračunat u cenu)', en: 'VAT 10% (included in price)' },
    amount: vatIncluded,
    kind: 'INCLUDED',
    estimate: false,
  });
  lines.push({
    code: 'NOTARY',
    label: { sr: 'Javni beležnik (solemnizacija)', en: 'Notary (solemnisation)' },
    amount: 320,
    kind: 'COST',
    estimate: true,
    note: { sr: 'Tarifa zavisi od vrednosti; procena za stan oko 100.000 €.', en: 'Fee depends on value; estimate for a flat of about €100,000.' },
  });
  lines.push({
    code: 'CADASTRE_FEES',
    label: { sr: 'Takse RGZ-a (predbeležba i uknjižba)', en: 'Cadastre fees (pre-registration and registration)' },
    amount: 100,
    kind: 'COST',
    estimate: true,
  });
  if (input.loanAmount > 0) {
    lines.push({
      code: 'MORTGAGE_COSTS',
      label: { sr: 'Kredit: procena, upis hipoteke, overa založne izjave', en: 'Mortgage: valuation, registration, pledge statement' },
      amount: 950,
      kind: 'COST',
      estimate: true,
      note: { sr: 'Bez NKOSK osiguranja, ako ga banka traži (1,5–3,5% kredita).', en: 'Excludes NKOSK insurance if required by the bank (1.5–3.5% of the loan).' },
    });
  }
  if (input.isFirstHome) {
    const allowedArea = 40 + 15 * Math.max(0, input.householdMembers - 1);
    const share = input.area > 0 ? Math.min(1, allowedArea / input.area) : 0;
    lines.push({
      code: 'VAT_REFUND',
      label: { sr: 'Povraćaj PDV-a za prvi stan', en: 'First-home VAT refund' },
      amount: Math.round(vatIncluded * share),
      kind: 'REFUND',
      estimate: true,
      note: {
        sr: `Do ${allowedArea} m² (40 m² za kupca i 15 m² po članu domaćinstva). Cela cena mora biti uplaćena na račun investitora.`,
        en: `Up to ${allowedArea} m² (40 m² for the buyer and 15 m² per household member). The full price must be paid to the developer's account.`,
      },
    });
  }
  return finish(lines, {
    sr: 'Procena. Tačne iznose daju beležnik, RGZ, banka i Poreska uprava.',
    en: 'Estimate. Exact amounts come from the notary, cadastre, bank and tax administration.',
  });
}

function rsLegalFindings(profile: BuyerProfileFacts): LegalFinding[] {
  const findings: LegalFinding[] = [];
  if (profile.isFirstHome) {
    findings.push({
      code: 'RS_VAT_REFUND',
      level: 'INFO',
      title: { sr: 'Pravo na povraćaj PDV-a', en: 'VAT refund eligibility' },
      text: {
        sr: 'Kao kupac prvog stana možete imati pravo na povraćaj PDV-a. Celu cenu platite na tekući račun investitora i sačuvajte dokaze.',
        en: 'As a first-home buyer you may be eligible for a VAT refund. Pay the full price to the developer’s current account and keep the proofs.',
      },
    });
  }
  if (profile.financing === 'MORTGAGE') {
    findings.push({
      code: 'RS_MORTGAGE_COMPLETION',
      level: 'WARNING',
      title: { sr: 'Kredit i stan u izgradnji', en: 'Mortgage and off-plan unit' },
      text: {
        sr: 'Banke obično isplaćuju kredit tek kada je zgrada izgrađena 60–80%. Ranije rate plaćate iz sopstvenog novca.',
        en: 'Banks usually disburse the loan only at 60–80% completion. Earlier instalments are paid from your own funds.',
      },
    });
  }
  if (profile.financing === 'MORTGAGE' && profile.age !== null && profile.age >= 20 && profile.age <= 35) {
    findings.push({
      code: 'RS_YOUTH_PROGRAM',
      level: 'INFO',
      title: { sr: 'Program stambenih kredita za mlade', en: 'Youth housing loan programme' },
      text: {
        sr: 'Možda ispunjavate uslove za kredit uz garanciju države (20–35 godina, učešće 1%). Za stan u izgradnji važi uslov izgrađenosti od najmanje 60%.',
        en: 'You may qualify for the state-guaranteed loan (age 20–35, 1% down payment). Off-plan units must be at least 60% complete.',
      },
    });
  }
  return findings;
}

function finish(lines: CostLine[], disclaimer: CostBreakdown['disclaimer']): CostBreakdown {
  const totalExtra = lines.filter((line) => line.kind === 'COST').reduce((sum, line) => sum + line.amount, 0);
  const totalRefund = lines.filter((line) => line.kind === 'REFUND').reduce((sum, line) => sum + line.amount, 0);
  return { lines, totalExtra, totalRefund, disclaimer };
}
