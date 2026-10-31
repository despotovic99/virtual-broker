// Srbija (model kapije): uspešna kupovina od kataloga do završene kupovine.
import {
  assert,
  completeStep,
  confirmCondition,
  confirmPhase,
  expectError,
  giveOpinion,
  guidedRequest,
  handover,
  installments,
  newBuyer,
  notificationTypes,
  openPurchase,
  pay,
  setupCatalog,
  skipStep,
  STAFF,
  uniqueDigits,
  unitStatus,
  assignTeam,
} from '../lib.mjs';

const PRICE = 124_000;
const PLAN = [
  { label: 'Potpis ugovora', amount: 37_200 },
  { label: 'Konstrukcija', amount: 62_000, phaseCode: 'STRUCTURE' },
  { label: 'Upotrebna dozvola', amount: 24_800, phaseCode: 'USE_PERMIT' },
];

export const scenario = {
  id: 'rs',
  title: 'Srbija: uspešna kupovina (kapija)',
  async run(team, rec) {
    const ctx = {};

    rec.section('Katalog');
    await rec.step('Investitor (zeleno), račun (četiri oka), projekat, provere, objava', async () => {
      Object.assign(
        ctx,
        await setupCatalog(team, {
          market: 'RS',
          registrationNumber: `2${uniqueDigits(6)}1`,
          name: 'Gradnja Vista',
          city: 'Novi Sad',
          units: [{ label: 'B-24', area: 62, price: PRICE }],
          verifyAccount: false,
          checks: [
            ['RS_PARCEL_OWNERSHIP', 'RS_PROPERTY_SHEET', 'analyst', 'Investitor je vlasnik parcele 1/1.'],
            ['RS_ENCUMBRANCES', 'RS_PROPERTY_SHEET', 'analyst', 'Bez hipoteka, zabeležbi i zabrana.'],
            ['RS_BUILDING_PERMIT', 'RS_BUILDING_PERMIT', 'analyst', 'Dozvola usklađena sa parcelom.'],
            ['RS_WORKS_NOTICE', 'RS_WORKS_NOTICE', 'analyst', 'Prijava radova podneta.'],
          ],
        }),
      );
      ctx.unitId = ctx.units['B-24'].id;
      await expectError(
        team.analyst.post(`/catalog/bank-accounts/${ctx.accountId}/verify`, { note: 'Proveren ugovor o računu.' }),
        'BANK_ACCOUNT_SAME_VERIFIER',
        'onaj ko je uneo račun ne sme da ga potvrdi',
      );
      await team.admin.post(`/catalog/bank-accounts/${ctx.accountId}/verify`, { note: 'Proveren izvod banke i ugovor.' });
      const semaphore = await team.analyst.get(`/checks/projects/${ctx.projectId}/semaphore`);
      assert(semaphore.project.overall === 'GREEN' && !semaphore.hardBlocked, 'projekat je zelen i bez blokade');
    });

    rec.section('Kupac i otvaranje kupovine');
    await rec.step('Kupac: registracija, profil, besplatna provera (zeleno), zahtev za stan', async () => {
      ctx.buyer = await newBuyer('rs');
      const check = await ctx.buyer.post('/requests', {
        kind: 'CHECK',
        market: 'RS',
        developerName: ctx.developerName,
        registrationNumber: ctx.registrationNumber,
      });
      assert(check.freeSemaphore?.developer?.overall === 'GREEN', 'besplatni semafor je zelen');
      ctx.request = await guidedRequest(ctx.buyer, ctx, ctx.unitId);
    });
    await rec.step('Koordinator otvara kupovinu iz zahteva; stan rezervisan; audit bez sivih provera', async () => {
      ctx.purchase = await openPurchase(team, ctx.request.id);
      assert(ctx.purchase.buyer?.id === ctx.buyer.user.id && ctx.purchase.unit.id === ctx.unitId, 'kupac i stan su iz zahteva');
      assert(ctx.purchase.steps.length === 17, '17 koraka');
      assert((await unitStatus(team, ctx.projectId, ctx.unitId)) === 'RESERVED', 'stan je rezervisan');
      const audit = await team.admin.get(`/audit?entityType=purchase&entityId=${ctx.purchase.id}&limit=100`);
      const created = audit.items.find((event) => event.action === 'purchase.created');
      assert(Array.isArray(created?.data?.uncheckedMandatory) && created.data.uncheckedMandatory.length === 0, 'uncheckedMandatory je prazan');
      await assignTeam(team, ctx.purchase, { lawyerEmail: STAFF.lawyerRs });
    });

    const id = () => ctx.purchase.id;
    rec.section('Provera i ugovor');
    await rec.step('Kupac S1–S2, koordinator S3–S5, bez mišljenja S6 se odbija', async () => {
      await completeStep(ctx.buyer, id(), 'S1', 'Budžet 130.000 €, prvi stan.');
      await completeStep(ctx.buyer, id(), 'S2', 'Izabran stan B-24.');
      for (const code of ['S3', 'S4', 'S5']) await completeStep(team.coordinator, id(), code);
      await expectError(team.lawyerRs.post(`/purchases/${id()}/steps/S6/complete`, {}), 'LEGAL_OPINION_REQUIRED', 'S6 traži pravno mišljenje');
    });
    await rec.step('Advokatica: mišljenje „potpisati”, S6, S7, predbeležba S8', async () => {
      await giveOpinion(team.lawyerRs, id(), 'SIGN', 'Ugovor je u skladu sa zakonom; investitor je vlasnik parcele, dozvole su ispravne.');
      await completeStep(team.lawyerRs, id(), 'S6');
      await completeStep(team.lawyerRs, id(), 'S7', 'Ugovor overen kod javnog beležnika.');
      ctx.preRegistration = await team.lawyerRs.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'RS_PRE_REGISTRATION' }, 'predbelezba.pdf');
      await completeStep(team.lawyerRs, id(), 'S8', 'Predbeležba upisana.');
    });

    rec.section('Rate');
    await rec.step('Plan sa pogrešnim zbirom se odbija; plan 30/50/20 je zaključan', async () => {
      await expectError(
        team.coordinator.put(`/purchases/${id()}/installments`, { installments: [{ label: 'Pogrešno', amount: 100_000 }] }),
        'PAYMENT_PLAN_TOTAL_MISMATCH',
        'zbir rata mora biti cena stana',
      );
      const plan = await team.coordinator.put(`/purchases/${id()}/installments`, { installments: PLAN });
      assert(plan.total === PRICE && plan.installments.every((item) => item.status === 'LOCKED'), 'plan pokriva cenu i sve rate su zaključane');
      ctx.installmentIds = plan.installments.map((item) => item.id);
    });
    await rec.step('Zaključana rata ne prima uplatu; uslovi otključavaju prvu ratu i kupac dobija obaveštenje', async () => {
      const proof = await ctx.buyer.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'PAYMENT_PROOF' }, 'preuranjena.pdf');
      await expectError(
        ctx.buyer.post(`/installments/${ctx.installmentIds[0]}/paid`, { proofDocumentId: proof.id }),
        'PAYMENT_CONDITIONS_NOT_MET',
        'zaključana rata',
      );
      const [first] = ctx.installmentIds;
      for (const code of ['RS_CONTRACT_NOTARIZED', 'RS_PERMIT_AND_NOTICE', 'RS_MORTGAGE_CLEAR']) await confirmCondition(team.lawyerRs, first, code);
      await confirmCondition(team.lawyerRs, first, 'RS_PRE_REGISTRATION', ctx.preRegistration.id);
      for (const installmentId of ctx.installmentIds) await confirmCondition(team.analyst, installmentId, 'RS_ACCOUNT_VERIFIED');
      const list = await installments(team, id());
      assert(list[0].status === 'READY' && list[1].status === 'LOCKED' && list[2].status === 'LOCKED', 'otključana je samo prva rata');
      assert((await notificationTypes(ctx.buyer)).includes('installment.ready'), 'kupac je dobio installment.ready');
    });
    await rec.step('Prva rata plaćena; faze Temelji i Konstrukcija otključavaju drugu; plaćena', async () => {
      await pay(team, ctx.buyer, id(), 0);
      await confirmPhase(team, ctx.projectId, 'FOUNDATION');
      await confirmPhase(team, ctx.projectId, 'STRUCTURE');
      await pay(team, ctx.buyer, id(), 1);
    });
    await rec.step('Upotrebna dozvola (advokatica + inženjer) otključava treću ratu; plaćena', async () => {
      const permit = await team.lawyerRs.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'RS_USE_PERMIT' }, 'upotrebna-dozvola.pdf');
      await confirmCondition(team.lawyerRs, ctx.installmentIds[2], 'RS_USE_PERMIT', permit.id);
      await confirmPhase(team, ctx.projectId, 'USE_PERMIT');
      await pay(team, ctx.buyer, id(), 2);
      assert(
        (await installments(team, id())).every((item) => item.status === 'PAID'),
        'sve rate su plaćene',
      );
    });

    rec.section('Završetak');
    await rec.step('S9–S11, primopredaja i ključevi, S12', async () => {
      await completeStep(team.coordinator, id(), 'S9');
      await completeStep(team.engineer, id(), 'S10');
      await completeStep(team.lawyerRs, id(), 'S11');
      await handover(team, ctx.buyer, id(), 62);
      await completeStep(team.engineer, id(), 'S12');
    });
    await rec.step('Uknjižba S13: kupovina ZAVRŠENA, stan PRODAT; opcioni koraci posle završetka', async () => {
      await team.lawyerRs.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'RS_TITLE_DECISION' }, 'uknjizba.pdf');
      const detail = await completeStep(team.lawyerRs, id(), 'S13');
      assert(detail.status === 'COMPLETED', `kupovina je završena (sada ${detail.status})`);
      assert((await unitStatus(team, ctx.projectId, ctx.unitId)) === 'SOLD', 'stan je prodat');
      await completeStep(team.lawyerRs, id(), 'S14', 'Zahtev za povraćaj PDV-a podnet.');
      await skipStep(team.coordinator, id(), 'S15', 'Porez prijavljuje kupac sam.');
      await skipStep(ctx.buyer, id(), 'S16', 'Komunalije sređujem sam.');
      await skipStep(team.engineer, id(), 'S17', 'Garantni rok se prati posle testa.');
      const final = await team.coordinator.get(`/purchases/${id()}`);
      assert(final.status === 'COMPLETED' && final.steps.every((item) => item.status !== 'PENDING'), 'završena, nijedan korak ne čeka');
    });

    return `kupovina ${ctx.purchase.id} · ${ctx.projectName}`;
  },
};
