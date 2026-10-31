// Zajednički delovi E2E testova: HTTP klijent po korisniku, koraci i provere,
// i pomoćne radnje koje se ponavljaju u scenarijima (katalog, kupac, kupovina, rate).

export const API = process.env.E2E_API ?? 'http://127.0.0.1:3000/api';
export const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:5173';
export const PASSWORD = process.env.E2E_PASSWORD ?? 'Broker-proba-2026';

const started = new Date();
const pad = (value) => String(value).padStart(2, '0');
/** Oznaka pokretanja (datum i vreme), deo imena svih podataka koje test pravi. */
export const RUN = `${pad(started.getMonth() + 1)}${pad(started.getDate())}-${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
export const TODAY = started.toISOString().slice(0, 10);

let sequence = Number(String(Date.now()).slice(-5));
/** Jedinstvene cifre (za matične brojeve i IBAN), različite u svakom pozivu. */
export function uniqueDigits(length = 6) {
  sequence += 1;
  return String(sequence).padStart(length, '0').slice(-length);
}

// ---------------------------------------------------------------------------
// HTTP

export class ApiFailure extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → HTTP ${status} ${body?.code ?? ''} ${body?.message ?? ''}`.trim());
    this.status = status;
    this.code = body?.code;
    this.details = body?.details;
  }
}

/** Najmanji PDF koji server prihvata (tip se određuje iz sadržaja, `%PDF-`). */
function pdf(title) {
  return new TextEncoder().encode(`%PDF-1.4\n% E2E ${title} ${RUN}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
}

export class Actor {
  constructor(label) {
    this.label = label;
    this.token = null;
    this.user = null;
  }

  headers(json) {
    const headers = { 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN };
    if (json) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async request(method, path, body) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: this.headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new ApiFailure(method, path, response.status, data);
    return data;
  }

  get(path) {
    return this.request('GET', path);
  }
  post(path, body = {}) {
    return this.request('POST', path, body);
  }
  patch(path, body = {}) {
    return this.request('PATCH', path, body);
  }
  put(path, body) {
    return this.request('PUT', path, body);
  }

  /** Otpremanje PDF-a (multipart, polje `file`). */
  async upload(fields, fileName) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('file', new Blob([pdf(fileName)], { type: 'application/pdf' }), fileName);
    const response = await fetch(`${API}/documents`, { method: 'POST', headers: this.headers(false), body: form });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new ApiFailure('POST', '/documents', response.status, data);
    return data;
  }

  async login(email, password = PASSWORD) {
    const data = await this.post('/auth/login', { email, password });
    this.token = data.accessToken;
    this.user = data.user;
    return data;
  }
}

// ---------------------------------------------------------------------------
// Koraci i provere

export function assert(condition, message) {
  if (!condition) throw new Error(`Provera nije prošla: ${message}`);
}

export async function expectError(promise, code, message) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiFailure && error.code === code) return error;
    throw new Error(`${message}: očekivana greška ${code}, a stiglo je: ${error.message}`);
  }
  throw new Error(`${message}: očekivana greška ${code}, a poziv je uspeo`);
}

/** Beleži korake jednog scenarija (ime, trajanje) i poslednji započeti korak. */
export class Recorder {
  constructor() {
    this.steps = [];
    this.current = '';
  }

  async step(name, run) {
    this.current = name;
    const begin = Date.now();
    await run();
    const ms = Date.now() - begin;
    this.steps.push({ name, ms });
    console.log(`    ✓ ${name} (${ms} ms)`);
  }

  section(title) {
    console.log(`\n  ${title}`);
  }
}

// ---------------------------------------------------------------------------
// Tim (prijavljuje se jednom za sve scenarije)

export const STAFF = {
  analyst: 'analiticar@broker.rs',
  admin: 'admin1@broker.rs',
  admin2: 'admin2@broker.rs',
  coordinator: 'koordinator@broker.rs',
  lawyerRs: 'advokat.rs@broker.rs',
  lawyerCy: 'advokat.cy@broker.rs',
  engineer: 'inzenjer@broker.rs',
  escrow: 'escrow@broker.rs',
};

export async function loginTeam() {
  const team = {};
  for (const [key, email] of Object.entries(STAFF)) {
    team[key] = new Actor(key);
    await team[key].login(email);
  }
  return team;
}

/** Nov kupac (registracija i prijava). */
export async function newBuyer(label, { isEuCitizen = false } = {}) {
  const buyer = new Actor(`kupac ${label}`);
  const email = `kupac.${label}.${RUN.replace('-', '')}.${uniqueDigits(3)}@broker.rs`;
  await buyer.post('/auth/register', { email, password: PASSWORD, firstName: 'Kupac', lastName: `${label} ${RUN}`, language: 'sr' });
  await buyer.login(email);
  assert(buyer.user.roles.includes('BUYER'), 'nov nalog je kupac');
  await buyer.put('/buyer-profile', { isFirstHome: true, isEuCitizen, primaryResidence: true, financing: 'CASH', householdMembers: 2 });
  buyer.email = email;
  return buyer;
}

// ---------------------------------------------------------------------------
// Katalog

/**
 * Investitor, račun (unosi analitičar, potvrđuje admin), projekat i stanovi.
 * `checks` su ručne provere projekta: [definicija, vrsta dokumenta | null, ko unosi (ključ tima), rezime].
 */
export async function setupCatalog(team, { market, registrationNumber, name, city, units, checks = [], verifyAccount = true, expectDeveloper = 'GREEN' }) {
  const ctx = { market };
  const developer = await team.analyst.post('/catalog/developers', {
    market,
    name: `${name} ${RUN}`,
    registrationNumber,
    address: `${city}, test adresa`,
  });
  ctx.developerId = developer.id;
  ctx.developerName = developer.name;
  ctx.registrationNumber = registrationNumber;

  const semaphore = await team.analyst.post('/checks/run', { developerId: developer.id });
  assert(semaphore.overall === expectDeveloper, `semafor investitora je ${expectDeveloper} (sada ${semaphore.overall})`);
  ctx.developerSemaphore = semaphore;

  const iban = `${market}${market === 'RS' ? '35' : '17'}${uniqueDigits(6)}${uniqueDigits(6)}${uniqueDigits(6)}`;
  const account = await team.analyst.post(`/catalog/developers/${developer.id}/bank-accounts`, { iban, bankName: 'Test banka', holderName: developer.name });
  ctx.accountId = account.id;
  if (verifyAccount) await team.admin.post(`/catalog/bank-accounts/${account.id}/verify`, { note: 'Proveren izvod banke i ugovor o računu.' });

  const project = await team.analyst.post('/catalog/projects', { developerId: developer.id, name: `${name} park ${RUN}`, city, address: 'Test ulica 1' });
  ctx.projectId = project.id;
  ctx.projectName = project.name;
  ctx.units = {};
  for (const unit of units) {
    const created = await team.analyst.post(`/catalog/projects/${project.id}/units`, {
      label: unit.label,
      floor: 2,
      rooms: 2,
      area: unit.area,
      price: unit.price,
    });
    ctx.units[unit.label] = created;
  }

  for (const [definitionCode, typeCode, by, summary] of checks) {
    const actor = team[by];
    let documentId;
    if (typeCode) documentId = (await actor.upload({ scope: 'PROJECT', projectId: project.id, typeCode }, `${definitionCode.toLowerCase()}.pdf`)).id;
    await actor.post('/checks', { projectId: project.id, definitionCode, status: 'GREEN', summary, ...(documentId ? { documentId } : {}) });
  }

  await team.analyst.patch(`/catalog/projects/${project.id}`, { status: 'PUBLISHED' });
  return ctx;
}

export async function unitStatus(team, projectId, unitId) {
  const detail = await team.coordinator.get(`/catalog/projects/${projectId}`);
  return detail.units.find((unit) => unit.id === unitId)?.status;
}

// ---------------------------------------------------------------------------
// Kupovina

/** Kupac traži „vodi moju kupovinu” za stan; vraća zahtev. */
export async function guidedRequest(buyer, ctx, unitId) {
  const request = await buyer.post('/requests', {
    kind: 'GUIDED_PURCHASE',
    market: ctx.market,
    projectId: ctx.projectId,
    unitId,
    question: 'Želim da kupim ovaj stan uz vašu pomoć.',
  });
  assert(request.unitId === unitId, 'zahtev je povezan sa stanom');
  return request;
}

/** Koordinator preuzima zahtev i otvara kupovinu iz njega (kupac i stan dolaze iz zahteva). */
export async function openPurchase(team, requestId) {
  await team.coordinator.post(`/requests/${requestId}/take`);
  const purchase = await team.coordinator.post('/purchases', { requestId });
  assert(purchase.status === 'ACTIVE', 'kupovina je aktivna');
  return purchase;
}

/** Dodela predloženog pravnog tima, advokata, inženjera i (Kipar) escrow partnera. */
export async function assignTeam(team, purchase, { lawyerEmail, escrowEmail }) {
  const market = purchase.market;
  const pick = async (role, email) => (await team.coordinator.get(`/users/staff?role=${role}&market=${market}`)).find((person) => person.email === email)?.id;
  const lawyerId = await pick('LAWYER', lawyerEmail);
  const engineerId = await pick('ENGINEER', STAFF.engineer);
  const escrowAgentId = escrowEmail ? await pick('ESCROW_AGENT', escrowEmail) : undefined;
  assert(lawyerId && engineerId && (!escrowEmail || escrowAgentId), 'advokat, inženjer (i escrow) postoje na tržištu');
  assert(purchase.proposedLegalTeam, 'sistem predlaže pravni tim');
  const updated = await team.coordinator.patch(`/purchases/${purchase.id}/assignments`, {
    legalTeamId: purchase.proposedLegalTeam.id,
    lawyerId,
    engineerId,
    ...(escrowAgentId ? { escrowAgentId } : {}),
  });
  assert(updated.lawyer?.id === lawyerId && updated.engineer?.id === engineerId, 'advokat i inženjer su dodeljeni');
  if (escrowAgentId) assert(updated.escrowAgent?.id === escrowAgentId, 'escrow partner je dodeljen');
  return updated;
}

export async function completeStep(actor, purchaseId, code, note) {
  const detail = await actor.post(`/purchases/${purchaseId}/steps/${code}/complete`, note ? { note } : {});
  const done = detail.steps.find((candidate) => candidate.code === code);
  assert(done?.status === 'DONE', `korak ${code} je DONE (sada ${done?.status})`);
  return detail;
}

export async function skipStep(actor, purchaseId, code, reason) {
  const detail = await actor.post(`/purchases/${purchaseId}/steps/${code}/skip`, { reason });
  const skipped = detail.steps.find((candidate) => candidate.code === code);
  assert(skipped?.status === 'SKIPPED', `korak ${code} je SKIPPED (sada ${skipped?.status})`);
  return detail;
}

/** Pravno mišljenje sa otpremljenim PDF-om. */
export async function giveOpinion(lawyer, purchaseId, conclusion, reasoning, conditions) {
  const document = await lawyer.upload({ scope: 'PURCHASE', purchaseId, typeCode: 'LEGAL_OPINION' }, `misljenje-${conclusion.toLowerCase()}.pdf`);
  const opinion = await lawyer.post(`/purchases/${purchaseId}/legal-opinions`, {
    conclusion,
    reasoning,
    documentId: document.id,
    ...(conditions ? { conditions } : {}),
  });
  assert(opinion.conclusion === conclusion, `mišljenje je ${conclusion}`);
  return opinion;
}

export async function installments(team, purchaseId) {
  return (await team.coordinator.get(`/purchases/${purchaseId}/installments`)).installments;
}

export async function confirmCondition(actor, installmentId, code, evidenceDocumentId) {
  await actor.post(`/installments/${installmentId}/conditions/${code}/confirm`, evidenceDocumentId ? { evidenceDocumentId } : {});
}

/** Kupac prijavi uplatu sa dokazom, koordinator je potvrdi; rata postaje PAID. */
export async function pay(team, buyer, purchaseId, index) {
  const installment = (await installments(team, purchaseId))[index];
  assert(installment.status === 'READY', `rata ${index + 1} je READY pre uplate (sada ${installment.status})`);
  const proof = await buyer.upload({ scope: 'PURCHASE', purchaseId, typeCode: 'PAYMENT_PROOF' }, `uplatnica-${index + 1}.pdf`);
  const reported = await buyer.post(`/installments/${installment.id}/paid`, { proofDocumentId: proof.id });
  assert(reported.status === 'READY' && reported.proofDocumentId === proof.id, 'posle prijave kupca rata čeka potvrdu');
  const paid = await team.coordinator.post(`/installments/${installment.id}/paid`, {});
  assert(paid.status === 'PAID', `rata ${index + 1} je PAID (sada ${paid.status})`);
  return paid;
}

/** Izveštaj inženjera koji potvrđuje fazu (uslov faze se ispunjava sam). */
export async function confirmPhase(team, projectId, phaseCode) {
  await team.engineer.post(`/projects/${projectId}/reports`, {
    phaseCode,
    visitDate: TODAY,
    summary: `Obilazak gradilišta: faza ${phaseCode} završena prema projektu.`,
    verdict: 'PHASE_CONFIRMED',
  });
}

/** Primopredaja: zapisnik, manji nedostatak (ispravljen pa potvrđen), ključevi. */
export async function handover(team, buyer, purchaseId, area) {
  const record = await team.engineer.post(`/purchases/${purchaseId}/handover`, {
    inspectedAt: new Date().toISOString(),
    contractArea: area,
    measuredArea: area - 0.4,
    notes: 'Površina u dozvoljenom odstupanju.',
  });
  assert(record.purchaseId === purchaseId, 'zapisnik o primopredaji postoji');
  const defect = await team.engineer.post(`/purchases/${purchaseId}/defects`, { description: 'Ogrebotina na ulaznim vratima.', severity: 'MINOR' });
  await team.coordinator.patch(`/defects/${defect.id}`, { status: 'FIXED' });
  await buyer.patch(`/defects/${defect.id}`, { status: 'CONFIRMED' });
  const keys = await team.coordinator.patch(`/purchases/${purchaseId}/handover/keys`, {});
  assert(keys.keysHandedAt, 'ključevi su predati');
}

export async function notificationTypes(actor) {
  const page = await actor.get('/notifications?limit=100');
  return page.items.map((item) => item.type);
}
