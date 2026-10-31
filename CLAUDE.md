# Pravila projekta (obavezna)

Virtuelni broker: platforma za sigurnu kupovinu stana na dva tržišta, Kipru (`CY`) i Srbiji (`RS`).
Stek: **NestJS 12 + TypeORM + PostgreSQL + Redis + S3/MinIO** (`server/`), **React + Vite + TypeScript** (`client/`), Node.js 24 LTS.
Specifikacija je u `specification/`, istraživanja u `docs/`.

## 1. Baza i migracije

- **Claude piše i menja samo entitete** (`*.entity.ts`). Migracije se nikad ne pišu ručno.
- **Sve komande za migracije se pokreću iz `api` kontejnera** (`docker compose exec api npm run ...`, iz root-a projekta), nikad sa hosta.
- **Migracije se generišu** komandom `docker compose exec api npm run migration:generate`. Terminal ispisuje `Enter migration name:` i čeka unos naziva u PascalCase-u (npr. `AddUsersTable`).
- **Migracije pokreće isključivo korisnik. Claude NIKADA ne pokreće nijednu komandu za migracije**: `migration:generate`, `migration:run:dev`, `migration:show:dev`, `migration:revert:dev`, `migration:run`, niti `typeorm` CLI direktno. Isto važi za bilo koju komandu koja menja šemu ili podatke u bazi.
- Posle izmene entiteta Claude samo napiše koje komande korisnik treba da pokrene i predloži naziv migracije, na primer:
  `docker compose exec api npm run migration:generate` (naziv: `AddUsersTable`), pa `docker compose exec api npm run migration:run:dev`
- Šema ide isključivo kroz migracije. `synchronize` je uvek isključen, a API sam ne pokreće migracije (`MIGRATIONS_RUN=false`).

### Komande za migracije (iz root-a, u `api` kontejneru)

| Komanda | Šta radi |
|---|---|
| `docker compose exec api npm run migration:generate` | Pita za naziv (`Enter migration name:`), briše `dist/`, pravi nov build i generiše migraciju u `src/database/migrations/` iz razlike entiteta i baze |
| `docker compose exec api npm run migration:run:dev` | Briše `dist/`, pravi nov build i pokreće migracije |
| `docker compose exec api npm run migration:show:dev` | Briše `dist/`, pravi nov build i prikazuje koje su migracije pokrenute |
| `docker compose exec api npm run migration:revert:dev` | Briše `dist/`, pravi nov build i vraća poslednju migraciju |
| `npm run migration:run` | Pokreće migracije iz postojećeg `dist/` builda, bez brisanja i build-a (za produkciju) |

Dev komande za migracije koriste isti `dist/` kao aplikacija: brišu ga i prave nov build (`npm run build:dev`). Na produkciji se `dist/` ne briše, `migration:run` radi nad postojećim produkcionim build-om. `server/` je montiran u kontejner kao `/app`, pa nova migracija odmah završi u `server/src/database/migrations/` na hostu. U kontejneru se baza zove `postgres` (DB_* promenljive iz `docker-compose.yml`); `data-source.ts` odbija da radi bez `DB_HOST`, pa komande ne rade sa hosta.

### Konekcije i transakcije (obavezno)

Kod se piše kvalitetno i uredno, a za svaki servis se zna **koliko konekcija otvara, kada i gde**.

- **Jedna operacija servisa = jedna konekcija.** Servisni metod koji započinje posao (poziva ga controller ili drugi ulaz) otvara **tačno jednu** konekciju kroz `DataSource.createQueryRunner()` i prosleđuje je (`queryRunner.manager`) svim delovima posla. Nikad se ne otvara nova konekcija usred iste operacije, ni u petlji, ni po pozivu drugog servisa.
- **Svaki upis ide kroz transakciju.** Ako operacija menja podatke (insert, update, delete), sav posao, koliko god ga bilo, ide kroz **jednu transakciju na toj jednoj konekciji**. Čisto čitanje ne otvara transakciju, ali i dalje koristi jednu konekciju sa `try/finally`.
- **Uvek `try / catch / finally` i uvek `release()`.** Konekcija se oslobađa u `finally`, bez izuzetka. U `catch` se radi rollback ako je transakcija aktivna, pa se greška prosleđuje kroz `throwApiError` (odeljak 2).
- **Metodi koji učestvuju u tuđoj operaciji** (drugi servisi, repozitorijumi) primaju `manager: EntityManager` kao prvi argument i rade samo kroz njega. Nikad sami ne otvaraju konekciju i nikad ne rade commit, rollback ni release.
- **Repozitorijum je jedini sloj koji priča sa bazom.** Controller nema pristup bazi, a servis ne piše upite mimo repozitorijuma.
- Kada se red menja na osnovu provere stanja, čita se sa `pessimistic_write` lock-om unutar transakcije.
- **Spoljni efekti** (Redis, e-mail, S3, pozivi drugih API-ja) idu **posle commit-a**, nikad unutar transakcije.
- Skupe operacije koje ne trebaju bazu (heširanje lozinke, pozivi spoljnih servisa) rade se pre otvaranja konekcije kad god je moguće, da konekcija ne stoji zauzeta.

Obrazac za metod koji upisuje:

```ts
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  const a = await this.usersRepository.insert(queryRunner.manager, ...);
  await this.otherService.doPart(queryRunner.manager, a); // ista konekcija, ista transakcija
  await queryRunner.commitTransaction();
  return result;
} catch (error) {
  if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
  throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)]); // videti odeljak 2
} finally {
  await queryRunner.release(); // OBAVEZNO
}
```

Obrazac za metod koji samo čita:

```ts
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
try {
  return await this.usersRepository.find(queryRunner.manager, ...);
} catch (error) {
  throwApiError(error);
} finally {
  await queryRunner.release(); // OBAVEZNO
}
```

## 2. Greške prema klijentu (obavezno)

**Sistemska greška nikad ne izlazi van API-ja.** Klijent dobija samo greške koje objašnjavaju poslovnu situaciju ili generičku grešku. Ništa što pukne, a nismo predvideli, ne sme da ode napolje: ni poruka, ni stack, ni SQL, ni naziv tabele.

- **Jedina greška koja izlazi je `ApiError`** (`server/src/common/errors/`). Oblik odgovora je uvek `{ statusCode, code, message, details? }`.
- **Katalog grešaka** je `api-error-code.ts` (`ApiErrorCode` + `API_ERRORS`: status i poruka na srpskom). Nova greška se dodaje samo tamo. Poruka objašnjava situaciju korisniku, a `details` sme da sadrži samo bezbedne podatke (npr. nazive polja).
- **Poslovna greška se baca direktno:** `throw new ApiError(ApiErrorCode.UserRoleNotAssignable)`. Nest-ove greške (`UnauthorizedException`, `ForbiddenException`, `ConflictException`…) se ne koriste u kodu.
- **`throwApiError(error, [očekivane])`** se poziva u `catch` bloku svakog metoda koji započinje operaciju (posle rollback-a). Kaže koje greške očekujemo i u šta se prevode, na primer `expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)`. `ApiError` prolazi nepromenjen, a sve neočekivano postaje `INTERNAL_ERROR`, uz original u logu.
- **Globalni filter `ApiExceptionFilter`** je poslednja zaštita. Nest-ove greške pretvara u generičke kodove po statusu, a sve ostalo u `INTERNAL_ERROR`. Detalji greške idu samo u log.
- Validacija (`ValidationPipe`) vraća `VALIDATION_FAILED` sa nazivima polja, bez tekstova class-validator-a. Greške body parser-a (neispravan JSON, prevelik zahtev) hvata `bodyParserErrorHandler`.
- Klijent odlučuje po `code`, ne po tekstu poruke.

## 3. Dev okruženje

- `docker-compose.yml` je samo za razvoj i sadrži **API, PostgreSQL, Redis i MinIO**. Produkcija ide preko `Dockerfile-prod` (pravi se kasnije).
- **Klijent se ne stavlja u Docker.** Pokreće se lokalno (`cd client && npm run dev`).
- Tajne su samo u `.env` (nije u git-u). Šablon je `.env.example`. Claude ne ispisuje sadržaj `.env`.
- Claude ne pokreće `docker compose up`, `npm install`, build ni testove ako korisnik to izričito ne traži.

## 4. Obim MVP-a

- **Investitorska platforma nije deo MVP-a** (F-27 portal investitora, F-28 sajt zgrade i ture, F-29 cena i best price guarantee). Razvija se u fazi 2. U MVP-u investitor nema ekrane, a njegove podatke i dokumenta unose naš tim i advokati. Plan rada je u `specification/README.md`, odeljak 10.

## 5. Tržišta

- Jezgro je zajedničko, a poslovni proces je po zemlji (specifikacija F-34). Moduli jezgra idu u `server/src/core/`, a paketi tržišta u `server/src/markets/cy` i `server/src/markets/rs`.
- Kod jezgra ne grana po kodu zemlje. Razlike idu kroz `MarketPack` i `MarketRegistry`.

## 6. Korisnici, prijava i prava pristupa

- Uloge: `SUPER_ADMIN`, `ADMIN`, `ANALYST`, `COORDINATOR`, `LAWYER`, `ENGINEER`, `ESCROW_AGENT`, `BUYER`, `INVESTOR` (`server/src/core/access/role.enum.ts`). Korisnik može imati više uloga (tabela `user_roles`).
- **SUPER_ADMIN samo administrira sistem** (korisnici, tržišta, timovi) i ne odlučuje o predmetima (razdvajanje dužnosti). Operativne odluke donose ADMIN, ANALYST, COORDINATOR, LAWYER, ENGINEER i ESCROW_AGENT.
- **ADMIN može sve na svojim tržištima:** ima sve capability osim samouslužnih radnji kupca (`requests:create`, `buyer-profile:manage`; lista se gradi iz enuma u `role-capabilities.ts`) i prolazi svaku proveru veze sa kupovinom (veza `ADMIN` u `PurchaseAccessService`, `require()` ga uvek pušta; ostala mesta koriste `isAdminOnMarket`). **Pravila četiri oka važe i za njega:** račun investitora ne potvrđuje onaj ko ga je uneo, a escrow isplatu odobravaju dva različita admina. Admina pravi i menja samo SUPER_ADMIN (`ROLE_CAN_ASSIGN`), a niko ne menja sopstvene uloge, tržišta i status.
- **Jedan nalog može imati više uloga** (npr. ANALYST + COORDINATOR); prava su unija prava svih uloga. Nove uloge važe posle ponovne prijave (uloge su u JWT-u).
- Uloge iz `MARKET_SCOPED_ROLES` rade samo na svojim tržištima (tabela `user_markets`, claim `markets` u JWT-u). Pristup kupovini proverava isključivo `PurchaseAccessService`: korisnik bez veze sa kupovinom dobija NOT_FOUND.
- **SUPER_ADMIN se nikad ne pravi niti dodeljuje kroz API.** Super admina korisnik dodaje ručno u bazu. Heš lozinke za ručni upis daje `docker compose exec api node /tools/hash-password.mjs` (parametri moraju ostati isti kao u `password.service.ts`). Kroz API se dodeljuju samo `ASSIGNABLE_ROLES`, i to samo uloge koje akter sme po `ROLE_CAN_ASSIGN`.
- **Svaki endpoint mora imati tačno jednu oznaku pristupa:** `@Public()`, `@Authenticated()` ili `@RequireCapabilities(...)`. Ruta bez oznake se odbija, a API ne krene (`AccessAuditService`).
- **Nova capability:** vrednost u `server/src/core/access/capability.enum.ts`, dodela ulogama u `role-capabilities.ts` (jedino mesto gde se vezuje uloga za capability) i ista vrednost u `client/src/core/auth/capabilities.ts`.
- Prijava: access token je JWT (10 min, samo u memoriji klijenta, `Authorization: Bearer`). Refresh token (7 dana) je u `HttpOnly` cookie-ju na `/api/auth`, rotira se na svako osvežavanje, a u bazi je samo njegov SHA-256 heš.
- Capability proverava server. Klijent ih koristi samo za prikaz (`<Can>`), nikad kao zaštitu.

## 7. Spoljne integracije

- U MVP-u su **sve spoljne integracije DUMMY** (`server/src/integrations/dummy/`): APR, NBS, Poreska uprava, kiparski registar firmi, registar likvidacija, DLS, email, tržišni indeks cena, banka i escrow isplata. Svaka je u kodu označena sa `DUMMY INTEGRACIJA` i `TODO(integracija)`, a rezultat nosi `dummy: true` i izvor koji počinje sa „DUMMY:”. Klijent takve podatke prikazuje sa oznakom DUMMY.
- Prava integracija se uključuje zamenom klase u `server/src/integrations/integrations.module.ts`. Spisak i šta svaka treba da radi je u `MVP-IMPLEMENTACIJA.md`.
- Spoljni izvori se zovu pre otvaranja konekcije ka bazi ili posle commit-a, nikad unutar transakcije.

## 8. Konvencije

- ESM: importi u `server/` imaju `.js` sufiks.
- Tekst u UI-ju je na jeziku tržišta. Za Srbiju se koristi srpski, latinica.
