# Konfiguracja bazy danych — instrukcja (polski)

Ten dokument wyjaśnia krok po kroku, gdzie umieścić ustawienia połączenia z bazą danych i jak je zweryfikować lokalnie. Przeznaczony dla osoby uruchamiającej projekt lokalnie po raz pierwszy.

1) Zmienne środowiskowe
- Umieść dane połączenia do PostgreSQL w pliku `.env.local` w katalogu projektu.
- Wymagana zmienna:

  - `DATABASE_URL`

- Przykład wartości (format):

```
postgresql://username:password@host:5432/database
```

- Ważne zasady:
  - Plik `.env.local` NIE powinien być commitowany do git (dodaj go do `.gitignore`).
  - Nigdy nie umieszczaj poświadczeń bezpośrednio w plikach źródłowych.

2) Gdzie używany jest connection string
- W projekcie istnieje pojedynczy punkt inicjalizacji połączenia: `src/db/db.ts`.
- Ten plik odczytuje `DATABASE_URL` z environmentu, tworzy klienta `postgres` (postgres-js) i inicjalizuje Drizzle.
- `src/db/db.ts` eksportuje helpery (`db`, `requireDb`) i to powinien być JEDYNY plik, który bezpośrednio odwołuje się do connection string (plik `lib/db.ts` jedynie re-eksportuje te wartości dla kompatybilności importów).

3) Warstwa repozytoriów (Repository layer)
- Wszystkie repozytoria (np. user, trip, board, session) powinny importować klienta Drizzle z `src/db/db.ts` i używać `requireDb()` lub `db()` do wykonywania zapytań.
- Repozytoria NIE powinny odczytywać zmiennych środowiskowych ani tworzyć nowych połączeń.

Przykład użycia w repozytorium:

```ts
import { requireDb } from 'src/db/db';
import { users } from 'src/db/schema';

export async function getUserByEmail(email: string) {
  const db = requireDb();
  const row = await db.select().from(users).where(users.email.eq(email)).limit(1);
  return row[0] ?? null;
}
```

4) API routes i logika serwera
- Wszystkie API routes i Server Actions MUSZĄ korzystać z repozytoriów do operacji na bazie danych.
- Nie twórz nowych połączeń w kodzie endpointów — używaj współdzielonego klienta z `src/db/db.ts`.
- Moduły odpowiadające za auth, dashboard i CRUD zależą od poprawnie ustawionej `DATABASE_URL`.

5) Migracje
- Konfiguracja migracji znajduje się w pliku `drizzle.config.ts` w katalogu projektu.
- Przykładowe polecenia (drizzle-kit):

```bash
# wygeneruj migrację na podstawie schematu src/db/schema.ts
npx drizzle-kit generate --config ./drizzle.config.ts

# zastosuj migracje do bazy (wymaga ustawionego DATABASE_URL)
npx drizzle-kit push --config ./drizzle.config.ts
```

- Uwaga: migracje uruchamiane są ręcznie (nie powinny być automatycznie wykonywane przy starcie aplikacji w runtime). Przed uruchomieniem migracji ustaw `DATABASE_URL`.

6) Weryfikacja lokalna — krok po kroku
- 1. Utwórz plik `.env.local` w katalogu projektu z linią `DATABASE_URL=...`.

```env
DATABASE_URL=postgresql://username:password@host:5432/database
```

- 2. Upewnij się, że plik jest w `.gitignore` i przechowuj go tylko lokalnie (sekrety w produkcji umieszczaj w menedżerze sekretów dostawcy — Vercel, Netlify, itp.).
- 3. (Opcjonalnie) Przetestuj połączenie prostym skryptem lub uruchamiając polecenie testowe:

```bash
# sprawdź, że zmienna istnieje
node -e "console.log(process.env.DATABASE_URL ? 'OK' : 'MISSING')"

# lub uruchom prosty skrypt, który importuje src/db/db.ts i wykonuje SELECT 1
node scripts/check-db.js
```

- 4. Wygeneruj i zastosuj migracje (patrz sekcja Migracje).
- 5. Zbuduj projekt lokalnie i uruchom:

```bash
npm run build
npm run dev
```

7) Najczęstsze błędy i jak je naprawić
- Brak `DATABASE_URL` — aplikacja nie połączy się z bazą. Sprawdź `.env.local`.
- Błędny format connection string — użyj formatu `postgresql://username:password@host:port/database`.
- Używanie Data API zamiast connection string — projekt oczekuje standardowego connection string w `DATABASE_URL`.
- Twardo zakodowane poświadczenia — nie commituj ich do repozytorium.

8) Dodatkowe uwagi
- Jeśli używasz Supabase, `DATABASE_URL` zwykle wygląda jak:

```
postgresql://<db_user>:<db_password>@db.<project>.supabase.co:5432/postgres
```

- Dla Supabase może być konieczne wymuszenie SSL. Implementacja w `src/db/db.ts` wykrywa hosty `supabase.co`/`supabase.com` i ustawia `ssl: { rejectUnauthorized: false }`; możesz też ustawić `DRIZZLE_SSL=true`, gdy uruchamiasz migracje.

Jeżeli chcesz, mogę teraz:
- wygenerować przykładowe pliki migracji w repozytorium, albo
- zaktualizować importy aby korzystały z `src/db` zamiast `lib/db`.
