// Pravno mišljenje „ne potpisivati” (Srbija).
// Grana A: korak ugovora ostaje zatvoren, koordinator i kupac dobijaju obaveštenje,
// koordinator blokira kupovinu dok se ugovor ne izmeni, advokatica daje novo
// mišljenje „potpisati uz uslove”, koordinator odblokira i kupovina ide dalje.
// Grana B: posle negativnog mišljenja koordinator otkazuje kupovinu i stan se oslobađa.
import {
  assert,
  assignTeam,
  completeStep,
  expectError,
  giveOpinion,
  guidedRequest,
  newBuyer,
  notificationTypes,
  openPurchase,
  setupCatalog,
  STAFF,
  uniqueDigits,
  unitStatus,
} from '../lib.mjs';

const REASON_NO = 'Ugovor ne predviđa povraćaj novca ako investitor kasni više od 12 meseci; rizik za kupca.';

async function toContractStep(team, buyer, purchaseId) {
  await completeStep(buyer, purchaseId, 'S1');
  await completeStep(buyer, purchaseId, 'S2');
  for (const code of ['S3', 'S4', 'S5']) await completeStep(team.coordinator, purchaseId, code);
}

export const scenario = {
  id: 'opinion',
  title: 'Pravno mišljenje „ne potpisivati”: blokada, novo mišljenje, otkaz',
  async run(team, rec) {
    const ctx = {};

    rec.section('Priprema');
    await rec.step('Katalog sa dva stana i dve kupovine do koraka ugovora', async () => {
      Object.assign(
        ctx,
        await setupCatalog(team, {
          market: 'RS',
          registrationNumber: `2${uniqueDigits(6)}1`,
          name: 'Pravni Test',
          city: 'Niš',
          units: [
            { label: 'D-1', area: 48, price: 76_000 },
            { label: 'D-2', area: 51, price: 81_000 },
          ],
          checks: [
            ['RS_PARCEL_OWNERSHIP', 'RS_PROPERTY_SHEET', 'analyst', 'Investitor je vlasnik parcele.'],
            ['RS_ENCUMBRANCES', 'RS_PROPERTY_SHEET', 'analyst', 'Bez tereta.'],
            ['RS_BUILDING_PERMIT', 'RS_BUILDING_PERMIT', 'analyst', 'Dozvola ispravna.'],
            ['RS_WORKS_NOTICE', 'RS_WORKS_NOTICE', 'analyst', 'Prijava radova podneta.'],
          ],
        }),
      );
      ctx.buyerA = await newBuyer('opa');
      ctx.buyerB = await newBuyer('opb');
      ctx.purchaseA = await openPurchase(team, (await guidedRequest(ctx.buyerA, ctx, ctx.units['D-1'].id)).id);
      ctx.purchaseB = await openPurchase(team, (await guidedRequest(ctx.buyerB, ctx, ctx.units['D-2'].id)).id);
      await assignTeam(team, ctx.purchaseA, { lawyerEmail: STAFF.lawyerRs });
      await assignTeam(team, ctx.purchaseB, { lawyerEmail: STAFF.lawyerRs });
      await toContractStep(team, ctx.buyerA, ctx.purchaseA.id);
      await toContractStep(team, ctx.buyerB, ctx.purchaseB.id);
    });

    rec.section('Grana A: blokada pa novo mišljenje');
    const a = () => ctx.purchaseA.id;
    await rec.step('Mišljenje „ne potpisivati”: S6 ostaje zatvoren', async () => {
      await giveOpinion(team.lawyerRs, a(), 'DO_NOT_SIGN', REASON_NO);
      await expectError(team.lawyerRs.post(`/purchases/${a()}/steps/S6/complete`, {}), 'LEGAL_OPINION_REQUIRED', 'negativno mišljenje ne otvara S6');
    });
    await rec.step('Koordinator i kupac dobijaju obaveštenje o negativnom mišljenju; kupovina nije sama blokirana', async () => {
      assert((await notificationTypes(team.coordinator)).includes('legal-opinion.negative'), 'koordinator je dobio legal-opinion.negative');
      assert((await notificationTypes(ctx.buyerA)).includes('legal-opinion.negative'), 'kupac je dobio legal-opinion.negative');
      const detail = await team.coordinator.get(`/purchases/${a()}`);
      assert(detail.status === 'ACTIVE', 'kupovina nije automatski blokirana');
    });
    await rec.step('Koordinator blokira kupovinu sa razlogom; koraci su zatvoreni dok traje blokada', async () => {
      const blocked = await team.coordinator.post(`/purchases/${a()}/block`, { reason: 'Čeka se izmena ugovora po pravnom mišljenju.' });
      assert(blocked.status === 'BLOCKED' && blocked.blockReason, 'kupovina je blokirana sa razlogom');
      await expectError(team.coordinator.post(`/purchases/${a()}/steps/S6/complete`, {}), 'INVALID_STATE_TRANSITION', 'blokirana kupovina ne prima korake');
    });
    await rec.step('Posle izmene ugovora advokatica daje „potpisati uz uslove” i dok je kupovina blokirana', async () => {
      await giveOpinion(
        team.lawyerRs,
        a(),
        'SIGN_WITH_CONDITIONS',
        'Investitor je dodao klauzulu o povraćaju novca uz kamatu ako kasni više od 12 meseci.',
        'Potpisati uz aneks o roku završetka.',
      );
    });
    await rec.step('Koordinator odblokira; S6 i S7 se završavaju i kupovina ide dalje', async () => {
      const unblocked = await team.coordinator.post(`/purchases/${a()}/unblock`);
      assert(unblocked.status === 'ACTIVE', 'kupovina je ponovo aktivna');
      await completeStep(team.lawyerRs, a(), 'S6', 'Mišljenje „potpisati uz uslove”.');
      await completeStep(team.lawyerRs, a(), 'S7', 'Ugovor sa aneksom overen.');
    });

    rec.section('Grana B: otkaz posle negativnog mišljenja');
    const b = () => ctx.purchaseB.id;
    await rec.step('Mišljenje „ne potpisivati”, koordinator otkazuje kupovinu; stan se oslobađa', async () => {
      await giveOpinion(team.lawyerRs, b(), 'DO_NOT_SIGN', REASON_NO);
      assert((await unitStatus(team, ctx.projectId, ctx.units['D-2'].id)) === 'RESERVED', 'stan je rezervisan pre otkaza');
      const cancelled = await team.coordinator.post(`/purchases/${b()}/cancel`);
      assert(cancelled.status === 'CANCELLED', 'kupovina je otkazana');
      assert((await unitStatus(team, ctx.projectId, ctx.units['D-2'].id)) === 'AVAILABLE', 'stan je ponovo slobodan');
      await expectError(team.coordinator.post(`/purchases/${b()}/steps/S6/complete`, {}), 'INVALID_STATE_TRANSITION', 'otkazana kupovina ne prima korake');
    });

    return `kupovina A ${ctx.purchaseA.id} nastavljena · kupovina B ${ctx.purchaseB.id} otkazana`;
  },
};
