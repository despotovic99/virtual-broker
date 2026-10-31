// Kipar (model escrow): kupovina sa isplatom investitoru preko escrow naloga.
// Plaćena rata pravi escrow nalog; dva različita admina ga odobravaju, a escrow
// partner izvršava isplatu, pa rata postaje ISPLAĆENA (RELEASED).
import {
  assert,
  assignTeam,
  completeStep,
  confirmCondition,
  confirmPhase,
  expectError,
  giveOpinion,
  guidedRequest,
  handover,
  installments,
  newBuyer,
  openPurchase,
  pay,
  setupCatalog,
  skipStep,
  STAFF,
  uniqueDigits,
  unitStatus,
} from '../lib.mjs';

const PRICE = 260_000;
const PLAN = [
  { label: 'Depozit po potpisu', amount: 78_000 },
  { label: 'Završetak gradnje', amount: 182_000, phaseCode: 'FINAL_APPROVAL' },
];

/** Escrow nalog za ratu: admin1, isti admin ponovo (odbijeno), admin2, pa izvršenje escrow partnera. */
async function releaseThroughEscrow(team, installmentId) {
  const list = await team.admin.get('/escrow/instructions?limit=100');
  const instruction = list.items.find((item) => item.installmentId === installmentId);
  assert(instruction, 'plaćena rata ima escrow nalog');
  assert(instruction.status === 'PENDING_APPROVAL', `nalog čeka odobrenje (sada ${instruction.status})`);
  assert(instruction.recipient?.iban, 'nalog nosi proveren račun investitora');

  await expectError(team.escrow.post(`/escrow/instructions/${instruction.id}/execute`), 'INVALID_STATE_TRANSITION', 'neodobren nalog ne može da se izvrši');
  const first = await team.admin.post(`/escrow/instructions/${instruction.id}/approve`);
  assert(first.firstApproverId === team.admin.user.id && first.status === 'PENDING_APPROVAL', 'prvi potpis, nalog i dalje čeka');
  await expectError(team.admin.post(`/escrow/instructions/${instruction.id}/approve`), 'ESCROW_SAME_APPROVER', 'isti admin ne potpisuje dvaput');
  const second = await team.admin2.post(`/escrow/instructions/${instruction.id}/approve`);
  assert(second.status === 'APPROVED' && second.secondApproverId === team.admin2.user.id, 'drugi potpis druge osobe: odobreno');

  const executed = await team.escrow.post(`/escrow/instructions/${instruction.id}/execute`);
  assert(executed.status === 'EXECUTED' && executed.executedAt, 'escrow partner je izvršio isplatu');
}

export const scenario = {
  id: 'cy',
  title: 'Kipar: kupovina sa escrow isplatom',
  async run(team, rec) {
    const ctx = {};
    const id = () => ctx.purchase.id;

    rec.section('Katalog (Kipar)');
    await rec.step('Investitor (zeleno), račun, projekat, provere (search certificate, dozvole, Form A, lokacija), objava', async () => {
      Object.assign(
        ctx,
        await setupCatalog(team, {
          market: 'CY',
          registrationNumber: `HE${uniqueDigits(6)}1`,
          name: 'Limassol Bay Developers',
          city: 'Limassol',
          units: [{ label: 'A-12', area: 85, price: PRICE }],
          checks: [
            ['CY_SEARCH_CERTIFICATE', 'CY_SEARCH_CERTIFICATE', 'analyst', 'Owner confirmed, no encumbrances besides the bank mortgage.'],
            ['CY_PERMITS', 'CY_BUILDING_PERMIT', 'analyst', 'Planning and building permits valid.'],
            ['CY_FORM_A', 'CY_FORM_A', 'lawyerCy', 'Bank signed Form A; unit released on payment.'],
            ['CY_NORTH_LOCATION', null, 'analyst', 'Limassol, outside the occupied north.'],
          ],
        }),
      );
      ctx.unitId = ctx.units['A-12'].id;
      const semaphore = await team.analyst.get(`/checks/projects/${ctx.projectId}/semaphore`);
      assert(semaphore.project.overall === 'GREEN' && !semaphore.hardBlocked, `projekat je zelen i bez blokade (sada ${semaphore.project.overall})`);
    });

    rec.section('Kupac (van EU) i kupovina');
    await rec.step('Kupac van EU: profil, zahtev za stan A-12; koordinator otvara kupovinu', async () => {
      ctx.buyer = await newBuyer('cy', { isEuCitizen: false });
      ctx.request = await guidedRequest(ctx.buyer, ctx, ctx.unitId);
      ctx.purchase = await openPurchase(team, ctx.request.id);
      assert(ctx.purchase.moneyModel === 'ESCROW', 'Kipar koristi escrow model');
      assert(ctx.purchase.steps.length === 17 && ctx.purchase.steps[0].code === 'K1', 'koraci K1–K17');
      assert((await unitStatus(team, ctx.projectId, ctx.unitId)) === 'RESERVED', 'stan je rezervisan');
    });
    await rec.step('Dodela kiparskog pravnog tima, advokatice, inženjera i escrow partnera', async () => {
      await assignTeam(team, ctx.purchase, { lawyerEmail: STAFF.lawyerCy, escrowEmail: STAFF.escrow });
    });

    rec.section('Priprema, provera i ugovor');
    await rec.step('K1 i K4 (kupac), K2–K3 (advokatica), K5 (analitičar), K6 (koordinator)', async () => {
      await completeStep(ctx.buyer, id(), 'K1', 'Budget 270,000 EUR.');
      await completeStep(team.lawyerCy, id(), 'K2', 'Power of attorney signed.');
      await completeStep(team.lawyerCy, id(), 'K3', 'TIC, bank account and AML done.');
      await completeStep(ctx.buyer, id(), 'K4', 'Unit A-12 chosen.');
      await completeStep(team.analyst, id(), 'K5', 'Due diligence green.');
      await completeStep(team.coordinator, id(), 'K6', 'Reservation deposit agreed.');
    });
    await rec.step('Mišljenje „potpisati”, K7–K9; dozvola Saveta ministara K10 (kupac van EU)', async () => {
      await giveOpinion(team.lawyerCy, id(), 'SIGN', 'Contract is fair; Form A in place, permits valid, title deeds issuable.');
      await completeStep(team.lawyerCy, id(), 'K7', 'Contract signed.');
      await completeStep(team.lawyerCy, id(), 'K8', 'VAT 19% (second home rules not applicable).');
      ctx.deposit = await team.lawyerCy.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'CY_CONTRACT_DEPOSIT' }, 'contract-deposit.pdf');
      await completeStep(team.lawyerCy, id(), 'K9', 'Contract deposited at the Land Registry.');
      await completeStep(team.lawyerCy, id(), 'K10', 'Council of Ministers permit applied.');
    });

    rec.section('Rate preko escrow-a');
    await rec.step('Plan od 2 rate (30% + 70%), obe zaključane', async () => {
      const plan = await team.coordinator.put(`/purchases/${id()}/installments`, { installments: PLAN });
      assert(plan.moneyModel === 'ESCROW' && plan.total === PRICE, 'escrow plan pokriva cenu');
      ctx.installmentIds = plan.installments.map((item) => item.id);
    });
    await rec.step('Uslovi prve rate (deponovan ugovor, Form A, dozvole, račun) otključavaju je; plaćena na escrow', async () => {
      const [first, last] = ctx.installmentIds;
      await confirmCondition(team.lawyerCy, first, 'CY_CONTRACT_DEPOSITED', ctx.deposit.id);
      await confirmCondition(team.lawyerCy, first, 'CY_FORM_A');
      await confirmCondition(team.lawyerCy, first, 'CY_PERMITS');
      for (const installmentId of [first, last]) await confirmCondition(team.analyst, installmentId, 'CY_ACCOUNT_VERIFIED');
      await pay(team, ctx.buyer, id(), 0);
    });
    await rec.step('Escrow: dva admina odobravaju (isti ne sme dvaput), escrow partner isplaćuje; rata ISPLAĆENA', async () => {
      await releaseThroughEscrow(team, ctx.installmentIds[0]);
      const list = await installments(team, id());
      assert(list[0].status === 'RELEASED', `prva rata je isplaćena investitoru (sada ${list[0].status})`);
    });
    await rec.step('Final approval (advokatica + inženjer) otključava drugu ratu; plaćena i isplaćena kroz escrow', async () => {
      const certificate = await team.lawyerCy.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'CY_FINAL_APPROVAL' }, 'final-approval.pdf');
      await confirmCondition(team.lawyerCy, ctx.installmentIds[1], 'CY_FINAL_APPROVAL', certificate.id);
      await confirmPhase(team, ctx.projectId, 'FINAL_APPROVAL');
      await pay(team, ctx.buyer, id(), 1);
      await releaseThroughEscrow(team, ctx.installmentIds[1]);
      assert(
        (await installments(team, id())).every((item) => item.status === 'RELEASED'),
        'obe rate su isplaćene investitoru',
      );
    });

    rec.section('Završetak i title deed');
    await rec.step('K11–K13, primopredaja i ključevi, K14', async () => {
      await completeStep(team.coordinator, id(), 'K11');
      await completeStep(team.engineer, id(), 'K12');
      await completeStep(team.engineer, id(), 'K13', 'Snagging done, final payment made.');
      await handover(team, ctx.buyer, id(), 85);
      await completeStep(team.engineer, id(), 'K14', 'Keys, electricity and water handed over.');
    });
    await rec.step('Title deed K15–K16: kupovina ZAVRŠENA, stan PRODAT; K17 preskočen posle završetka', async () => {
      await completeStep(team.lawyerCy, id(), 'K15', 'Separate title deeds issued.');
      await team.lawyerCy.upload({ scope: 'PURCHASE', purchaseId: id(), typeCode: 'CY_TITLE_DEED' }, 'title-deed.pdf');
      const detail = await completeStep(team.lawyerCy, id(), 'K16', 'Title transferred to the buyer.');
      assert(detail.status === 'COMPLETED', `kupovina je završena (sada ${detail.status})`);
      assert((await unitStatus(team, ctx.projectId, ctx.unitId)) === 'SOLD', 'stan je prodat');
      await skipStep(ctx.buyer, id(), 'K17', 'Ongoing costs handled by the owner.');
    });

    return `kupovina ${ctx.purchase.id} · ${ctx.projectName}`;
  },
};
