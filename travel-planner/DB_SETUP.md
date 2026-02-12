Konfiguracja bazy danych i integracja z Drizzle
=============================================

Ten dokument wyjaśnia, gdzie i jak umieścić informacje o połączeniu z bazą danych dla projektu Travel Planner oraz jak aplikacja używa Drizzle ORM.

1) Connection string (wymagane)
- Utwórz plik środowiskowy w katalogu głównym aplikacji Next: `.env.local` (ten plik NIE powinien być dodawany do repozytorium).
- Dodaj łańcuch połączenia Postgres jako `DATABASE_URL`:

  DATABASE_URL=postgresql://username:password@host:port/dbname

- NIE umieszczaj poświadczeń bezpośrednio w plikach TS/JS. Trzymaj `.env.local` poza systemem kontroli wersji (dodaj go do `.gitignore`).

2) Konfiguracja Drizzle (wspólny klient)
- Pojedynczy klient Drizzle znajduje się w `src/db/db.ts` (plik `lib/db.ts` jedynie go re-eksportuje dla zachowania kompatybilności importów).
- Obowiązki `src/db/db.ts`:
  - Importuje `postgres` (postgres-js) oraz `drizzle` z `drizzle-orm/postgres-js`.
  - Odczytuje `DATABASE_URL` z `process.env`.
  - Tworzy klienta z opcjonalnym SSL (automatycznie wykrywa Supabase / możesz wymusić przez `DRIZZLE_SSL`).
  - Eksportuje `db` oraz helper `requireDb()` który rzuca jasny błąd, jeśli `DATABASE_URL` nie jest ustawiony.

3) Repozytoria
- Kanoniczne repozytoria znajdują się w `src/db/repositories/*` (user, session, trip, board, boardItem).
- Importują one `requireDb()` z `src/db/db.ts` (przez `lib/db.ts`) i wykonują zapytania Drizzle. Żaden kod repozytorium nie powinien sam tworzyć połączeń.

4) Trasy API / Server Actions
- Logika backendowa (rejestracja, logowanie, CRUD) odwołuje się do repozytoriów z `src/db/repositories/*`.
- Nie używaj pamięci in-memory dla produkcji. Kod testowy został przeniesiony poza runtime; trzymaj się warstwy DB przy wszystkich operacjach.

5) Migracje
- Pliki migracji znajdują się w katalogu `drizzle/` i bazują na schemacie `./src/db/schema.ts`.
- Przykład (drizzle-kit):

  npx drizzle-kit generate --config ./drizzle.config.ts
  npx drizzle-kit push --config ./drizzle.config.ts

- ZAWSZE sprawdź wartość `DATABASE_URL` przed uruchomieniem migracji, aby uniknąć zastosowania zmian w niewłaściwej bazie.

6) Porady i troubleshooting
- Sprawdź połączenie szybko za pomocą prostego skryptu, który importuje `lib/db.ts` i wykonuje `SELECT 1` przed uruchomieniem aplikacji.
- Jeśli aplikacja zgłasza "DATABASE_URL is not configured", upewnij się, że `.env.local` istnieje i jest wczytywany (Next.js automatycznie ładuje `.env.local` przy `next dev` i podczas build jeśli plik istnieje).
- Typowe błędy:
  - Nieprawidłowy format URL → upewnij się, że odpowiada `postgresql://user:pass@host:port/dbname`.
  - Brak dostępu sieciowego / firewall → upewnij się, że host bazy pozwala na połączenia z twojego środowiska.
  - SSL / Supabase: `lib/db.ts` rozpoznaje hosty zawierające `supabase.co` i automatycznie ustawia `ssl: { rejectUnauthorized: false }` tam, gdzie to potrzebne.

7) Oddzielenie środowisk
- Używaj różnych źródeł sekretów:
  - Lokalnie: `.env.local` (plik pozostaje wyłącznie na Twojej maszynie).
  - Produkcja / staging: zdefiniuj `DATABASE_URL` w menedżerze sekretów platformy (Vercel, Railway, Netlify). Nie commituj sekretów do repo.

8) Lista weryfikacyjna
- Po utworzeniu `.env.local` i skierowaniu go na swoją bazę Postgres:
  - Uruchom `npm install`, aby upewnić się, że zależności (`pg`, `drizzle-orm`) są zainstalowane.
  - Uruchom `npm run build` — build powinien zakończyć się pomyślnie.
  - Uruchom `npm run dev` i odwiedź aplikację. Przepływy rejestracji/logowania powinny korzystać z bazy danych.

Polecenia
--------
Instalacja i uruchomienie:

```bash
npm install
npm run build
npm run dev
```

Jeśli chcesz, mogę wygenerować pliki migracji Drizzle dla aktualnego schematu (`users`, `trips`, `sessions`) i dodać krótką instrukcję uruchamiania migracji.

Uwaga bezpieczeństwa
---------------------
- Nigdy nie commituj `.env.local` do repozytorium. W produkcji używaj menedżera sekretów lub mechanizmu zmiennych środowiskowych dostarczanego przez platformę hostującą.

Skontaktuj się, jeśli chcesz, żebym wygenerował skrypty migracji dla bieżącego schematu i krótką checklistę wdrożeniową dla Supabase.
Database setup & Drizzle integration
=================================

This document explains where and how to provide database configuration for the Travel Planner project and how the app uses Drizzle ORM.

1) Connection string (required)
- Create a local environment file at the project root of the Next app: `.env.local` (this file should NOT be committed).
- Add your Postgres connection string as `DATABASE_URL`:

  DATABASE_URL=postgresql://username:password@host:port/dbname

- Do NOT hardcode credentials inside TS/JS files. Keep `.env.local` out of version control (add it to `.gitignore`).

2) Shared Drizzle instance
- The canonical Drizzle client lives in `src/db/db.ts` (and `lib/db.ts` simply re-exports it for backwards compatibility).
- Responsibilities of `src/db/db.ts`:
  - Import the `postgres` client (`postgres` package) and `drizzle` from `drizzle-orm/postgres-js`.
  - Read `DATABASE_URL` from `process.env`.
  - Create the client with optional SSL (auto-detected for Supabase or forced via `DRIZZLE_SSL`).
  - Export the `db` instance and `requireDb()` helper that throws when `DATABASE_URL` is missing.

3) Repositories
- Canonical repositories live under `src/db/repositories/*` (user, session, trip, board, boardItem).
- Each repository imports `requireDb()` and must remain free of connection-handling logic.

4) API routes and Server Actions
- Backend routes import from `src/db/repositories/*` so every request flows through the DB-backed repositories.
- In-memory helpers have been removed from runtime — always hit the database for production logic.

5) Migrations
- Migration SQL lives in `drizzle/` and is generated from `./src/db/schema.ts`.
- Example (drizzle-kit):

  npx drizzle-kit generate --config ./drizzle.config.ts
  npx drizzle-kit push --config ./drizzle.config.ts

- Always double-check `DATABASE_URL` before running migrations to avoid applying schema changes to the wrong database.

6) Optional tips & troubleshooting
- Test connectivity quickly with a tiny script that imports `lib/db.ts` and runs a simple `SELECT 1` before using the app.
- If the app fails with "DATABASE_URL is not configured", verify `.env.local` exists and is loaded (Next.js loads `.env.local` automatically when running `next dev` or during build if present in the workspace).
- Common errors:
  - Wrong URL format → ensure it matches `postgresql://user:pass@host:port/dbname`.
  - Missing network access / firewall → ensure your DB host allows connections from your environment.
  - SSL / Supabase: `lib/db.ts` checks for `supabase.co` in the host and sets `ssl: { rejectUnauthorized: false }` where appropriate.

7) Environment separation
- Keep secrets out of Git:
  - Local: `.env.local` (file stays on your machine only).
  - Production: define `DATABASE_URL` via your hosting provider's secret manager. Rotate credentials immediately if secrets ever leak.

8) Verification checklist
- After creating `.env.local` and pointing it to your Postgres DB:
  - Run `npm install` to ensure dependencies are present (`pg`, `drizzle-orm`).
  - Run `npm run build` — build should succeed.
  - Run `npm run dev` and visit the app. Register/login flows should use the database.

Commands
--------
Install & run:

```bash
npm install
npm run build
npm run dev
```

If you want help creating migrations for the current schema (users, trips, sessions), I can add drizzle-kit migration files to the repo.

Security note
-------------
- Never commit `.env.local` to source control. Use environment secrets management for production credentials.

Contact me if you want me to generate migration scripts for the current schema and a short checklist for deploying to Supabase.
