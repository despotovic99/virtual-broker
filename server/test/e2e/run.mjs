// Pokretač E2E scenarija (kroz API, nad dev bazom; API mora da radi).
//
//   cd server && npm run e2e                  svi scenariji
//   cd server && npm run e2e -- cy red        samo izabrani (rs, cy, red, opinion)
//
// Tim se prijavljuje jednom za sve scenarije (8 prijava), a svaki scenario
// registruje svoje kupce. Prijava je ograničena na 20 pokušaja po IP-u u
// 15 minuta, pa je jedno pokretanje svih scenarija otprilike jedno u 15 minuta.
import { API, Recorder, RUN, loginTeam } from './lib.mjs';
import { scenario as cy } from './scenarios/cy-escrow.mjs';
import { scenario as opinion } from './scenarios/negative-opinion.mjs';
import { scenario as red } from './scenarios/red-developer.mjs';
import { scenario as rs } from './scenarios/rs-success.mjs';

const ALL = [rs, cy, red, opinion];
const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !ALL.some((item) => item.id === name));
if (unknown.length > 0) {
  console.error(`Nepoznat scenario: ${unknown.join(', ')}. Postoje: ${ALL.map((item) => item.id).join(', ')}`);
  process.exit(2);
}
const selected = wanted.length > 0 ? ALL.filter((item) => wanted.includes(item.id)) : ALL;

console.log(`E2E · pokretanje ${RUN} · ${API} · scenariji: ${selected.map((item) => item.id).join(', ')}`);

let team;
try {
  team = await loginTeam();
} catch (error) {
  console.error(`\n✗ Prijava tima nije uspela: ${error.message}`);
  process.exit(1);
}

const summary = [];
for (const item of selected) {
  console.log(`\n▶ ${item.title}`);
  const rec = new Recorder();
  const begin = Date.now();
  try {
    const note = await item.run(team, rec);
    summary.push({ item, ok: true, steps: rec.steps.length, ms: Date.now() - begin, note });
  } catch (error) {
    console.error(`    ✗ ${rec.current}`);
    console.error(`      ${error.message}`);
    if (error.details) console.error(`      detalji: ${JSON.stringify(error.details)}`);
    summary.push({ item, ok: false, steps: rec.steps.length, ms: Date.now() - begin, note: `pao korak: ${rec.current}` });
  }
}

console.log('\nRezime');
for (const row of summary) {
  console.log(`  ${row.ok ? '✔' : '✗'} ${row.item.title}: ${row.steps} koraka, ${(row.ms / 1000).toFixed(1)} s · ${row.note}`);
}
process.exitCode = summary.every((row) => row.ok) ? 0 : 1;
