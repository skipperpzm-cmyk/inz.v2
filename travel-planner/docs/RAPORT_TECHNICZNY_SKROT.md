# Skrócony raport techniczny projektu Travel Planner

## 1. Cel i charakter systemu
Travel Planner to webowy system hybrydowy (Next.js App Router), łączący klasyczny model request-response z synchronizacją realtime. Najważniejszą częścią projektu jest moduł współdzielonych tablic (boards) dla grup użytkowników, z postami, komentarzami i moderacją.

## 2. Architektura (najważniejsze fakty)
- Architektura klient–serwer: UI (React/Next.js) + API Routes + PostgreSQL (Supabase).
- Warstwa kliencka korzysta z Context API (`BoardsContext`, `BoardDetailContext`, `GroupContext`) do orkiestracji stanu i działań asynchronicznych.
- Warstwa serwerowa realizuje autoryzację, walidację, logikę domenową i dostęp do danych.
- Model danych i bezpieczeństwa oparty jest na relacyjnym PostgreSQL, FK, indeksach oraz RLS.

## 3. Kluczowe decyzje technologiczne
- **Frontend**: Next.js 16, React 18, TypeScript, Tailwind CSS.
- **Backend/BFF**: Next.js API Routes.
- **Dane**: PostgreSQL + Drizzle ORM + SQL bezpośredni w endpointach boardowych.
- **Realtime**: Supabase Realtime (`postgres_changes`) z filtrowaniem po `board_id`.
- **Auth**: sesje cookie httpOnly + login hasłem + magic link.

Znaczenie dla pracy inżynierskiej: projekt pokazuje praktyczne połączenie architektury webowej, modelu realtime i kontroli dostępu na poziomie aplikacji i bazy.

## 4. Model danych modułu Boards (rdzeń projektu)
Najważniejsze tabele i relacje:
- `groups` (grupy),
- `group_members` (członkowie grup),
- `boards` (wiele tablic na grupę),
- `board_members` (dostęp do tablic),
- `board_moderators` (delegowane uprawnienia),
- `group_posts` i `group_comments` (timeline i dyskusja).

Najważniejsze cechy modelu:
- relacje 1:N z pełnymi kluczami obcymi,
- cascade delete,
- indeksy pod odczyty timeline i komentarzy,
- paginacja cursor-based (`created_at + id`) dla postów i komentarzy.

## 5. Bezpieczeństwo i autoryzacja
- Uwierzytelnianie: hasło (bcrypt) i magic link (token jednorazowy, hash SHA-256, TTL).
- Sesja: cookie `travel-planner-session` (httpOnly, sameSite).
- Autoryzacja domenowa: role Owner / Moderator / Member.
- Ochrona endpointów: walidacja sesji, UUID i członkostwa.
- RLS: polityki `SELECT/INSERT/UPDATE/DELETE` dla tabel grup i tablic, plus `FORCE ROW LEVEL SECURITY`.

Wniosek: bezpieczeństwo jest realizowane wielowarstwowo (UI nie jest źródłem prawdy; decyzje zapadają po stronie API i DB).

## 6. Realtime i spójność danych
- Subskrypcje tabel: `boards`, `board_members`, `board_moderators`, `group_posts`, `group_comments`.
- Integracja z Context API: eventy planują odświeżenie danych (debounce), a nie bezpośredni patch całości stanu.
- Reconnect strategy: obsługa `CHANNEL_ERROR/TIMED_OUT/CLOSED` i automatyczny reload.
- Integracja z optimistic UI: rekordy tymczasowe + reconciliation + rollback przy błędzie.

Znaczenie: projekt rozwiązuje typowy problem systemów realtime – konflikt między szybkością UI a spójnością między klientami.

## 7. Wydajność i stabilność
Najważniejsze zastosowane mechanizmy:
- `useMemo`/`useCallback` dla stabilizacji referencji,
- `AbortController` dla przerwanych requestów,
- cleanup subskrypcji i timerów,
- throttle/debounce dla ograniczania burz renderów i eventów,
- podział kontekstów (listy vs detal) ograniczający re-rendering.

## 8. Problemy techniczne i ich rozwiązania
Najważniejsze klasy problemów:
- race conditions,
- duplikacja optimistic + realtime,
- podwójne subskrypcje,
- memory leaks,
- re-render storms.

Zastosowane rozwiązania:
- kontrola lifecycle efektów,
- deduplikacja rekordów po `id` i czasie,
- rollback lokalnych zmian,
- jawny cleanup przy zmianie trasy.

## 9. Skalowalność i ograniczenia
Mocne strony:
- dobry model relacyjny,
- paginacja cursor-based,
- indeksy pod ścieżki krytyczne,
- role i RLS gotowe na multi-user workload.

Główne ograniczenia:
- część logiki SQL osadzona bezpośrednio w endpointach,
- strategia refetch-on-event (prostsza, ale bardziej kosztowna sieciowo),
- dług techniczny: konieczna pełna synchronizacja definicji schematu Drizzle z aktualnym modelem boardów.

## 10. Wniosek końcowy (dla pracy inżynierskiej)
Projekt prezentuje dojrzałą implementację współdzielonego systemu tablic z kontrolą dostępu, realtime i spójnym modelem danych. Największą wartością inżynierską jest połączenie:
1) wielopoziomowego bezpieczeństwa (sesje + role + RLS),
2) mechanizmów eventual consistency (optimistic UI + realtime),
3) praktycznych technik stabilizacji i wydajności w aplikacji React/Next.

Jest to odpowiednia baza do rozdziałów pracy inżynierskiej dotyczących: architektury systemu webowego, projektowania modelu danych, bezpieczeństwa aplikacji oraz mechanizmów synchronizacji czasu rzeczywistego.