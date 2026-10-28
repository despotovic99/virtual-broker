# Virtuelni broker

Platforma za sigurnu kupovinu stana na dva tržišta, Kipru i Srbiji. Specifikacija je u `specification/`, a istraživanja su u `docs/`.

Šta je implementirano u MVP-u, dummy integracije i kako se pokreće: `MVP-IMPLEMENTACIJA.md`. Pregled za čitaoce koji nisu programeri: `MVP-PREGLED.md`.

| Deo | Tehnologija |
|---|---|
| `server/` | NestJS 12, TypeScript 6, TypeORM, PostgreSQL, Redis, S3 (MinIO u dev-u) |
| `client/` | React 19, Vite 8, TypeScript 6 |
| Node.js | 24.22.1 LTS (`.nvmrc`) |

## Lokalni razvoj

API, baza, Redis i MinIO rade u Docker-u. Klijent se pokreće lokalno.

```sh
docker compose up --build   # .env već postoji; za novo okruženje: cp .env.example .env

cd client
npm install
npm run dev
```

| Servis | Adresa |
|---|---|
| Klijent (lokalno, Vite) | http://localhost:5173 |
| API | http://localhost:3000/api/health |
| MinIO konzola | http://localhost:9001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Svi servisi su u Docker mreži `virtual-broker`, pa API do njih dolazi po imenu servisa (`postgres`, `redis`, `minio`). Portovi na hostu su vezani samo za `127.0.0.1`.

`docker-compose.yml` služi samo za razvoj. Produkcioni build ide preko `Dockerfile-prod`, koji se pravi kasnije.

## Struktura servera

- `src/core/`: moduli jezgra, zajednički za oba tržišta.
- `src/markets/`: paketi tržišta (`cy`, `rs`). Jezgro pita paket preko `MarketRegistry` i ne grana po kodu zemlje (specifikacija F-34).
- `src/database/migrations/`: šema baze ide samo kroz migracije. Komande su u `CLAUDE.md` (odeljak 1): `npm run migration:generate` (pita za naziv), `npm run migration:run:dev`, `npm run migration:show:dev`.
