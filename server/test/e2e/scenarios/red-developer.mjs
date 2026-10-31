// Crveni investitor: firma u likvidaciji i blokiran račun (probna provera: matični
// broj na 0). Provera firme i blokade računa su tvrda blokada: kupac vidi crveno
// odmah, a kupovina ne može da se otvori; stan ostaje slobodan, zahtev otvoren.
import { assert, expectError, guidedRequest, newBuyer, setupCatalog, uniqueDigits, unitStatus } from '../lib.mjs';

export const scenario = {
  id: 'red',
  title: 'Crveni investitor: tvrda blokada',
  async run(team, rec) {
    const ctx = {};

    rec.section('Katalog sa crvenim investitorom');
    await rec.step('Investitor sa matičnim brojem na 0: automatske provere crvene, tvrda blokada', async () => {
      Object.assign(
        ctx,
        await setupCatalog(team, {
          market: 'RS',
          registrationNumber: `2${uniqueDigits(6)}0`,
          name: 'Rizik Gradnja',
          city: 'Beograd',
          units: [{ label: 'C-3', area: 54, price: 98_000 }],
          expectDeveloper: 'RED',
        }),
      );
      ctx.unitId = ctx.units['C-3'].id;
      assert(ctx.developerSemaphore.hardBlocked === true, 'semafor investitora ima tvrdu blokadu');
      const red = ctx.developerSemaphore.items.filter((item) => item.status === 'RED').map((item) => item.code);
      assert(red.includes('RS_APR_STATUS') && red.includes('RS_NBS_BLOCKADE'), `crveni su status firme i blokada računa (${red.join(', ')})`);
      const project = await team.analyst.get(`/checks/projects/${ctx.projectId}/semaphore`);
      assert(project.hardBlocked === true, 'semafor projekta prenosi tvrdu blokadu investitora');
    });

    rec.section('Kupac vidi rizik');
    await rec.step('Besplatna provera kupcu pokazuje crveno i tvrdu blokadu (rizik se ne skriva)', async () => {
      ctx.buyer = await newBuyer('red');
      const check = await ctx.buyer.post('/requests', {
        kind: 'CHECK',
        market: 'RS',
        developerName: ctx.developerName,
        registrationNumber: ctx.registrationNumber,
      });
      assert(check.freeSemaphore?.developer?.overall === 'RED', `besplatni semafor je crven (sada ${check.freeSemaphore?.developer?.overall})`);
      assert(check.freeSemaphore.developer.hardBlocked === true, 'besplatni semafor pokazuje tvrdu blokadu');
    });

    rec.section('Kupovina se ne otvara');
    await rec.step('Kupac ipak traži vođenje; koordinator ne može da otvori kupovinu (PURCHASE_HARD_BLOCKED)', async () => {
      const request = await guidedRequest(ctx.buyer, ctx, ctx.unitId);
      await team.coordinator.post(`/requests/${request.id}/take`);
      await expectError(
        team.coordinator.post('/purchases', { requestId: request.id }),
        'PURCHASE_HARD_BLOCKED',
        'crveni investitor blokira otvaranje kupovine',
      );
      assert((await unitStatus(team, ctx.projectId, ctx.unitId)) === 'AVAILABLE', 'stan je ostao slobodan');
      const after = await team.coordinator.get(`/requests/${request.id}`);
      assert(after.status === 'IN_TRIAGE' && !after.purchaseId, `zahtev je ostao otvoren, bez kupovine (status ${after.status})`);
    });

    return `investitor ${ctx.developerName} · zahtev ostaje otvoren`;
  },
};
