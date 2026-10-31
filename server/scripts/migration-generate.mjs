// Pravi novu migraciju iz razlike između entiteta i baze. Ne pokreće migracije.
// Upotreba (iz root-a projekta): docker compose exec api npm run migration:generate
// pa uneti naziv kada se zatraži.
import { execFileSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

const NAME_PATTERN = /^[A-Z][A-Za-z0-9]{2,99}$/;

async function askName() {
  const rl = createInterface({ input, output });
  try {
    for (;;) {
      const name = (await rl.question('Enter migration name: ')).trim();
      if (NAME_PATTERN.test(name)) return name;
      console.error('Naziv je PascalCase, samo slova i cifre, najmanje 3 znaka (npr. AddUsersTable).');
    }
  } finally {
    rl.close();
  }
}

const name = await askName();
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });

// Uvek sveži build: briše se dist, pa se pravi nov.
run('npm', ['run', 'build:dev']);
run('typeorm', [
  'migration:generate',
  `src/database/migrations/${name}`,
  '-d',
  'dist/database/data-source.js',
  '--pretty',
]);
