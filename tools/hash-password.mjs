#!/usr/bin/env node
// Generiše heš lozinke za ručni upis u bazu (npr. za super admina).
// Ne dira bazu, samo ispiše heš za kolonu users.password_hash.
//
// Upotreba (iz root-a projekta): node tools/hash-password.mjs
//
// Parametri MORAJU biti isti kao u server/src/core/users/password.service.ts.
import { randomBytes, scryptSync } from 'node:crypto';

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

/** Čita unos iz terminala bez prikazivanja znakova. */
function readHidden(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    console.error('Skripta mora da se pokrene u terminalu (lozinka se unosi ručno).');
    process.exit(1);
  }

  return new Promise((resolve) => {
    let value = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          cleanup();
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
        } else if (char >= ' ') {
          value += char;
        }
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 256 * N * R });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

const password = await readHidden('Enter password: ');
if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
  console.error(`Lozinka mora imati između ${MIN_LENGTH} i ${MAX_LENGTH} znakova.`);
  process.exit(1);
}

const confirmation = await readHidden('Repeat password: ');
if (confirmation !== password) {
  console.error('Lozinke se ne poklapaju.');
  process.exit(1);
}

console.log(hashPassword(password));
