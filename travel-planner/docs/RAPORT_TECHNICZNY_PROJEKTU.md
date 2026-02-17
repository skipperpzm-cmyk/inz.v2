# Raport techniczny projektu Travel Planner

## Spis treści

1. [Przegląd systemu](#1-przegląd-systemu)
2. [Architektura wysokiego poziomu](#2-architektura-wysokiego-poziomu)
3. [Stack technologiczny](#3-stack-technologiczny)
   - [3.1 Frontend](#31-frontend)
   - [3.2 Backend / Warstwa API](#32-backend--warstwa-api)
   - [3.3 Baza danych](#33-baza-danych)
   - [3.4 Realtime](#34-realtime)
   - [3.5 System autoryzacji i bezpieczeństwa](#35-system-autoryzacji-i-bezpieczeństwa)
4. [Moduł Tablic (Boards)](#4-moduł-tablic-boards)
5. [Zarządzanie stanem i wydajność](#5-zarządzanie-stanem-i-wydajność)
6. [Skalowalność systemu](#6-skalowalność-systemu)
7. [Problemy techniczne i ich rozwiązania](#7-problemy-techniczne-i-ich-rozwiązania)
8. [Decyzje projektowe i kompromisy](#8-decyzje-projektowe-i-kompromisy)
9. [Gotowość produkcyjna](#9-gotowość-produkcyjna)
10. [Podsumowanie techniczne](#10-podsumowanie-techniczne)

---

# 1. Przegląd systemu

## 1.1 Charakterystyka ogólna aplikacji

Travel Planner jest systemem webowym realizującym dwa równoległe cele domenowe:

1. klasyczne planowanie podróży (moduł tripów),
2. współdzieloną pracę grupową na tablicach (boards) z osią czasu, komentarzami i moderacją.

Aplikacja jest zaprojektowana jako rozwiązanie wielomodułowe, w którym użytkownik uwierzytelniony otrzymuje dostęp do przestrzeni dashboardowej obejmującej:

- zarządzanie profilem użytkownika,
- moduł znajomych i zaproszeń,
- komunikację (chat),
- moduł grup,
- moduł tablic grupowych,
- notyfikacje,
- elementy „presence” (online/offline).

System łączy model synchroniczny request-response (REST-like API Routes) z modelem asynchronicznym realtime opartym o subskrypcje zmian w PostgreSQL (Supabase Realtime `postgres_changes`). To powoduje, że aplikacja operuje w trybie hybrydowym: dane krytyczne i inicjalne pochodzą z żądań HTTP, a synchronizacja między klientami realizowana jest kanałami push.

## 1.2 Typ systemu (webowy, SSR/CSR/hybrydowy)

Projekt wykorzystuje Next.js (App Router) i model hybrydowy renderowania:

- komponenty serwerowe (Server Components) dla routingu i ochrony obszaru dashboard,
- komponenty klienckie (Client Components) dla stanu interaktywnego i realtime,
- API Routes jako backend aplikacyjny (w tym auth, boards, groups, user).

W praktyce warstwa UI modułów dynamicznych (np. `BoardDetailClient`) jest utrzymywana po stronie klienta, z intensywnym użyciem React hooks. Warstwa serwerowa odpowiada za:

- kontrolę dostępu,
- walidację,
- odczyt/zapis do bazy,
- wydawanie tokenów sesyjnych i tokenu realtime.

Oznacza to architekturę „SSR shell + CSR domain runtime” dla dashboardu.

## 1.3 Główne moduły funkcjonalne

Najważniejsze obszary funkcjonalne:

1. **Auth**
   - logowanie hasłem,
   - logowanie magic linkiem,
   - sesje cookie (`travel-planner-session`),
   - wylogowanie i aktualizacja statusu online.

2. **Profile i identyfikacja użytkownika**
   - `public_id` jako publiczny identyfikator,
   - `username_display` dla prezentacji,
   - routing profilu oparty o ID/public ID po usunięciu modelu slug.

3. **Groups**
   - tworzenie grup,
   - członkostwo i role (`admin`/`member`),
   - zaproszenia grupowe,
   - zarządzanie członkami.

4. **Boards (moduł centralny raportu)**
   - multi-board per group,
   - członkostwo tablicowe (`board_members`),
   - moderacja (`board_moderators`),
   - posty, komentarze, info podróży, timeline.

5. **Realtime i obecność użytkownika**
   - subskrypcja zmian tabel,
   - synchronizacja stanu UI,
   - heartbeat / offline cleanup.

6. **Komunikacja i notyfikacje**
   - chat i notyfikacje jako osobne moduły oparte na tych samych prymitywach infrastrukturalnych.

## 1.4 Zakres odpowiedzialności aplikacji

Zakres odpowiedzialności systemu obejmuje:

- zarządzanie tożsamością i sesją użytkownika,
- autoryzację operacji per grupa/tablica,
- trwałe przechowywanie danych planowania i dyskusji,
- kontrolę dostępu na poziomie API i (docelowo) RLS,
- near-real-time synchronizację współdzielonych widoków,
- ochronę integralności danych przy działaniach współbieżnych.

System nie pełni roli pełnego event-sourcingu ani CQRS. Stan biznesowy utrzymywany jest głównie jako bieżący stan relacyjny, a aktualizacje klienta realizowane są przez:

1. optimistic update,
2. późniejsze potwierdzenie serwerowe,
3. ewentualne reconciliation po eventach realtime.

## 1.5 Model działania: request-response + realtime

Model operacyjny aplikacji dla modułu tablic:

1. klient ładuje widok tablicy (`/dashboard/boards/[groupId]/[boardId]`),
2. context wykonuje bootstrap danych (`loadBoard`, `loadPosts`),
3. klient pobiera token realtime (`/api/supabase/realtime-token`),
4. zakłada kanały subskrypcji dla kluczowych tabel,
5. interakcje użytkownika wysyłają mutacje API,
6. UI stosuje optimistic update,
7. eventy `postgres_changes` wyzwalają odświeżenia z debounce,
8. cleanup usuwa kanały i abortuje żądania przy unmount/route change.

System jest zatem projektowany pod eventual consistency w granicach pojedynczych modułów ekranowych, przy zachowaniu spójności autoryzacyjnej po stronie serwera.

---

# 2. Architektura wysokiego poziomu

## 2.1 Model architektoniczny

### 2.1.1 Klient–serwer

Aplikacja implementuje klasyczny model klient–serwer:

- **Klient**: React/Next.js Client Components + Context API.
- **Serwer aplikacyjny**: Next.js API Routes.
- **Warstwa danych**: PostgreSQL (Supabase) + Drizzle + zapytania SQL.

Interfejs klienta nie komunikuje się bezpośrednio z bazą poza kanałem realtime, który nadal jest autoryzowany tokenem wystawianym przez backend.

### 2.1.2 Warstwy systemu

Warstwy logiczne:

1. **Presentation/UI**
   - komponenty `components/*`,
   - strony App Router `app/*`,
   - layout dashboardu z ochroną dostępu.

2. **State Orchestration**
   - `contexts/*` (`GroupContext`, `BoardsContext`, `BoardDetailContext`),
   - custom hooks (`useBoard`).

3. **Transport/API**
   - `app/api/*` endpointy HTTP,
   - tokenizacja i kontrola sesji,
   - walidacja payloadów.

4. **Domain/Data Access**
   - `src/db/repositories/*` (częściowo),
   - SQL bezpośrednio w route handlers (szczególnie boards).

5. **Persistence & Security**
   - PostgreSQL schema + migracje `drizzle/*.sql`,
   - polityki RLS,
   - publikacje realtime.

### 2.1.3 Podział odpowiedzialności

- **UI**: render, akcje użytkownika, obsługa lokalnych stanów przejściowych.
- **Context**: koordynacja wywołań API, konsolidacja danych, retry/reconnect.
- **API**: autoryzacja, walidacja, egzekucja reguł dostępu.
- **DB**: constraints, FK, RLS, publikacje eventów.

Kluczowa cecha architektury: reguły bezpieczeństwa nie są ufane po stronie klienta; klient może ukrywać/przycinać UI, ale finalna decyzja o mutacji zapada w endpointach i/lub politykach bazy.

## 2.2 Przepływ danych

### 2.2.1 UI → Context → API → Baza danych

Przykład `createPost`:

1. użytkownik publikuje treść w `BoardDetailClient`,
2. `BoardDetailContext.createPost` tworzy wpis optymistyczny `temp-post-*`,
3. wysyłane jest `POST /api/boards/{groupId}/{boardId}/posts`,
4. API waliduje sesję i członkostwo tablicowe,
5. SQL wykonuje `insert into public.group_posts`,
6. odpowiedź zawiera utworzony post,
7. context podmienia wpis tymczasowy na rekord serwerowy.

Analogiczny przepływ istnieje dla komentarzy i mutacji metadanych tablicy.

### 2.2.2 Realtime → Context → UI

Dla aktywnej tablicy context zakłada kanały:

- `group_posts` filtrowane po `board_id`,
- `group_comments` po `board_id`,
- `boards` po `id`,
- `board_moderators` po `board_id`.

Eventy nie aktualizują od razu lokalnego stanu przez patch delta, tylko planują odświeżenia przez opóźniony reload (ok. 120 ms), co ogranicza burze renderów i duplikaty zapytań.

### 2.2.3 Obsługa optimistic update

Mechanizm optimistic update zawiera trzy warstwy ochronne:

1. **Identyfikatory tymczasowe** (`temp-post-*`, `temp-comment-*`),
2. **Reconciliation**: porównanie rekordów serwerowych z optymistycznymi,
3. **Rollback** przy błędzie/abort.

W `BoardDetailContext` istnieje funkcja `reconcileOptimisticPosts`, która ogranicza duplikację między optimistic i realtime przez dopasowanie autora, treści i okna czasowego.

## 2.3 Diagram logiczny (opis tekstowy)

### 2.3.1 Komponenty

- `BoardDetailClient` – ekran tablicy i interakcje użytkownika,
- `BoardDetailContext` – orkiestracja stanu tablicy,
- `BoardsContext` – lista tablic i grup,
- `GroupContext` – grupy, zaproszenia, członkowie,
- `app/api/boards/*` – warstwa endpointów boardowych,
- PostgreSQL + RLS + publication realtime.

### 2.3.2 Zależności

1. `BoardDetailClient` zależy od `useBoard()` (czyli `BoardDetailContext`).
2. `BoardDetailContext` zależy od `fetch`, `getBrowserSupabase`, endpointów `/api/boards/*`.
3. Endpointy zależą od `getCurrentUserId`, `sqlClient` i modułu moderacji `_lib/moderation`.
4. `_lib/moderation` zależy od tabel `boards`, `board_members`, `board_moderators`, `groups`.
5. Realtime zależy od tokenu JWT generowanego przez `/api/supabase/realtime-token`.

### 2.3.3 Komunikacja

Kanały komunikacji:

- HTTP (synchronizacja bazowa i mutacje),
- websocket realtime (eventy DB),
- local React state (UI transitional state),
- cookie session (tożsamość użytkownika).

Model ten minimalizuje coupling między ekranami a backendem i pozwala na niezależny rozwój endpointów oraz logiki kontekstów.

---

# 3. Stack technologiczny

## 3.1 Frontend

### 3.1.1 Framework i router

Projekt wykorzystuje Next.js 16.x i App Router (`app/*`) jako główny mechanizm routingu. W repozytorium występuje katalog `pages/`, ale jest pusty, co wskazuje na migrację zakończoną po stronie runtime.

**Dlaczego wybrano Next.js + App Router**:

- zintegrowane API routes,
- natywna obsługa Server/Client Components,
- łatwa ochrona segmentów aplikacji na poziomie layoutów,
- dobra integracja z deploymentem serverless.

**Problemy rozwiązane**:

- rozdzielenie shella serwerowego i interakcji klienckich,
- uproszczenie struktury monorepo front-back (jeden runtime).

**Ograniczenia**:

- złożoność granic server/client,
- ryzyko podwójnego wywoływania efektów w Strict Mode,
- konieczność ostrożnego zarządzania stanem globalnym.

### 3.1.2 Server vs Client Components

W module dashboardowym Server Components pełnią głównie funkcję gatekeepera (np. `app/dashboard/layout.tsx` wykonuje `getCurrentUserId` i redirect na `/login`). Właściwa logika ekranów dynamicznych (`BoardDetailClient`, `BoardsClient`) działa po stronie klienta.

Wpływ na architekturę:

- autoryzacja wejściowa realizowana wcześnie (layout),
- interaktywność i realtime pozostają w warstwie klienta,
- brak nadmiernych roundtripów dla każdej interakcji UI.

### 3.1.3 TypeScript

System jest konsekwentnie typowany w warstwie UI i API. Typy domenowe tablic (`types/board.ts`) obejmują posty, komentarze, travel info, role moderacyjne.

**Rola TypeScript**:

- kontrakty między contextami i komponentami,
- ochrona przed niespójnością payloadów,
- łatwiejsze refaktory przy ewolucji modelu danych.

**Ograniczenia**:

- część endpointów używa `any` podczas mapowania surowego SQL,
- nie wszystkie kontrakty runtime są walidowane schemą (wyjątkiem jest np. auth login z Zod).

### 3.1.4 Context API i custom hooks

Najważniejsze konteksty:

- `GroupContext` (grupy i zaproszenia),
- `BoardsContext` (lista tablic),
- `BoardDetailContext` (aktywna tablica),
- hook `useBoard` jako adapter do `BoardDetailContext`.

**Dlaczego Context API**:

- wystarczający poziom dla zasięgu stanu ograniczonego do domeny,
- brak konieczności dodatkowego dependency (Redux/Zustand) przy zachowaniu czytelności,
- łatwa integracja z React hooks.

**Ograniczenia**:

- przy dużych value objectach ryzyko re-render storm,
- konieczność dyscypliny `useMemo`/`useCallback`.

### 3.1.5 Zarządzanie stanem, efekty i renderowanie

W `BoardDetailContext` występują świadome mechanizmy antyniestabilności:

- memoizacja value kontekstu,
- abortowanie in-flight fetchy,
- dedykowane `Ref` dla cursorów i flag in-flight,
- throttling dodawania komentarzy,
- debounce reloadów realtime.

W `BoardDetailClient` użyto:

- lokalnych stanów formularzy i UI modali,
- `AbortController` dla mutacji,
- cleanup on unmount.

**Wpływ na architekturę**:

- bezpieczne działanie w `reactStrictMode: true`,
- redukcja wyścigów i memory leaków,
- przewidywalność przejść stanu.

### 3.1.6 Routing dynamiczny

Routing boardów opiera się o:

- `/dashboard/boards/[groupId]`
- `/dashboard/boards/[groupId]/[boardId]`

`groupId` jest obsługiwane elastycznie (UUID lub slug) po stronie API. To umożliwia kompatybilność wsteczną i łagodną migrację identyfikatorów.

### 3.1.7 Mechanizm ładowania danych i obsługa błędów

Dla board detail bootstrap jest dwuetapowy:

1. `loadBoard` (meta + uprawnienia),
2. `loadPosts` (pierwsza strona timeline).

Obsługa błędów:

- statusy 401/403/404 tłumaczone na akcje nawigacyjne,
- komunikaty toast,
- rollback optimistic update,
- ignorowanie `AbortError` jako kontrolowanej ścieżki.

---

## 3.2 Backend / Warstwa API

## 3.2.1 Struktura endpointów

API jest zorganizowane domenowo:

- `app/api/auth/*`
- `app/api/user/*`
- `app/api/groups/*`
- `app/api/boards/*`
- `app/api/supabase/realtime-token`
- dodatkowe moduły (`messages`, `notifications`, `trips`, `profiles`).

### 3.2.2 API routes i logika domenowa

W module boards endpointy obejmują:

- listowanie grup boardowych (`GET /api/boards`),
- listę tablic grupy (`GET /api/boards/[groupId]`),
- tworzenie tablicy (`POST /api/boards/[groupId]`),
- detail tablicy (`GET /api/boards/[groupId]/[boardId]`),
- posty i komentarze (CRUD + paginacja),
- moderatorów i członków tablicy,
- zaproszenia na tablice, opuszczanie tablicy.

Logika domenowa nie jest wyłącznie w repozytoriach – znaczna część reguł znajduje się bezpośrednio w route handlers w postaci zapytań SQL.

### 3.2.3 Walidacja danych

Warstwa API stosuje walidację:

- schematyczną (`zod`) dla loginu,
- ręczną walidację długości/typów dla postów/komentarzy,
- walidację UUID (regex `UUID_RE`) dla parametrów dynamicznych,
- ograniczenia `limit` i `commentLimit` z clamp do wartości bezpiecznych.

To ogranicza wektory manipulacji ID oraz nadmiernych payloadów.

### 3.2.4 Autoryzacja requestów

Autoryzacja bazuje na:

- sesji cookie (`travel-planner-session`),
- `getCurrentUserId()` i `getCurrentUser()`,
- sprawdzeniach członkostwa (`board_members`, `group_members`),
- sprawdzeniach roli właściciela/moderatora.

Ważne: endpointy boardowe nie polegają na samym ukrywaniu elementów UI. Każda operacja krytyczna jest potwierdzana po stronie backendu.

### 3.2.5 Obsługa błędów i kody statusów

Przyjęte wzorce:

- 401 dla braku autoryzacji,
- 403 dla braku uprawnień,
- 404 dla zasobów niedostępnych lub spoza kontekstu użytkownika,
- 422 dla błędów domenowych (np. długość treści),
- 500 dla błędów nieobsłużonych.

Dodatkowo obsługiwane są timeouty bazy (`isConnectTimeoutError`) z mapowaniem na odpowiedzi degradacyjne.

### 3.2.6 Middleware

W projekcie brak globalnego `middleware.ts`; autoryzacja jest realizowana przez:

- server layout w dashboardzie,
- walidację per-endpoint.

To podejście upraszcza kontrolę przepływu, ale powoduje powtarzalność logiki ochronnej.

### 3.2.7 Separacja danych i prezentacji

Architektura jest częściowo warstwowa:

- część modułów korzysta z `src/db/repositories/*` (users/sessions/magic links),
- moduł boards używa bezpośredniego SQL w endpointach.

Zaletą jest pełna kontrola SQL i wydajność. Wadą – mniejsza spójność warstwy data access i trudniejsza standaryzacja.

---

## 3.3 Baza danych

## 3.3.1 Model relacyjny

Model danych łączy część „legacy travel” z częścią „group collaboration”. Dla modułu tablic kluczowe relacje wynikają z migracji `0034–0040`:

- `groups` (1) — (N) `boards`,
- `groups` (1) — (N) `group_members`,
- `boards` (1) — (N) `board_members`,
- `boards` (1) — (N) `board_moderators`,
- `boards` (1) — (N) `group_posts`,
- `group_posts` (1) — (N) `group_comments`.

## 3.3.2 Struktura tabel wymaganych

### `groups`

- klucz: `id uuid PK`,
- pola biznesowe: `name`, `slug`, `description`, `is_private`,
- właściciel: `created_by -> profiles(id)`,
- audyt czasowy: `created_at`, `updated_at`,
- constraints: niepusta nazwa, regex sluga.

### `group_members`

- `id uuid PK`,
- `group_id FK -> groups(id) ON DELETE CASCADE`,
- `user_id FK -> profiles(id) ON DELETE CASCADE`,
- `role` (`member`/`admin`),
- unikalność `(group_id, user_id)`.

### `boards`

Po migracji wielotablicowej tabela rozszerzona o:

- `group_id FK -> groups(id)`,
- `title`, `description`, `created_by`, `updated_at`,
- pola travel info (`location`, daty, `travel_description`, `budget`, `checklist`, `details`).

### `board_moderators`

- `board_id FK -> boards(id) ON DELETE CASCADE`,
- `user_id FK -> profiles(id) ON DELETE CASCADE`,
- `assigned_by`, `created_at`,
- unique `(board_id, user_id)`.

### `board_members`

- `board_id FK -> boards(id) ON DELETE CASCADE`,
- `user_id FK -> profiles(id) ON DELETE CASCADE`,
- `added_by`, `created_at`,
- unique `(board_id, user_id)`.

### `group_posts`

- `board_id FK -> boards(id) ON DELETE CASCADE`,
- `group_id FK -> groups(id) ON DELETE CASCADE`,
- `author_id`, `content`, `created_at`, `updated_at`.

### `group_comments`

- `post_id FK -> group_posts(id) ON DELETE CASCADE`,
- `board_id FK -> boards(id) ON DELETE CASCADE`,
- `group_id FK -> groups(id) ON DELETE CASCADE`,
- `author_id`, `content`, `created_at`, `updated_at`.

## 3.3.3 Klucze obce, indeksy, cascade delete

W module boards zastosowano:

- silne FK z `ON DELETE CASCADE` dla danych podrzędnych,
- indeksy pokrywające typowe zapytania listujące:
  - `idx_boards_group_id`,
  - `idx_group_posts_board_id_created_at`,
  - `idx_group_comments_post_id_created_at`,
  - `idx_group_comments_board_id`,
  - `idx_board_members_board_id`, `idx_board_members_user_id`,
  - `idx_board_moderators_board_id`.

Taki zestaw ogranicza koszt sortowań po czasie i filtracji po `board_id`.

## 3.3.4 Strategia migracji

Migracje SQL są wersjonowane w `drizzle/*.sql` i realizują kroki ewolucyjne:

1. model grupowy (`0034`, `0035`),
2. migracja do multi-board (`0037`),
3. porządki i globalne RLS enable (`0038`),
4. moderacja (`0039`),
5. członkostwo boardowe (`0040`).

Wzorzec migracji zawiera:

- `if exists / if not exists` (idempotencja),
- migracje danych (backfill),
- triggery utrzymujące spójność,
- update publikacji realtime.

## 3.3.5 Publikacje realtime

W migracjach ustawiono:

- `replica identity full` na tabelach eventowych,
- dodanie tabel do `supabase_realtime` publication.

Dzięki temu payloady `postgres_changes` zawierają komplet rekordów (przydatne szczególnie dla operacji delete/update).

## 3.3.6 Paginacja i optymalizacja zapytań

W endpointach postów zastosowano paginację cursor-based:

- cursor zakodowany jako `base64url(createdAt|id)`,
- warunek „strictly older” po `(created_at, id)`,
- `limit + 1` dla wyznaczenia `hasMore`.

Dla komentarzy użyto limitu z osobnym kursorem per post.

Korzyści:

- stabilna paginacja przy rosnącej liczbie rekordów,
- brak kosztu przesunięć typowego dla dużego `OFFSET`.

---

## 3.4 Realtime

## 3.4.1 Mechanizm subskrypcji

Realtime oparty jest o Supabase JS client (`getBrowserSupabase`) i kanały `postgres_changes`.

Typowy bootstrap:

1. klient pobiera token z `/api/supabase/realtime-token`,
2. `supabase.realtime.setAuth(token)`,
3. tworzenie kanałów per tabela i filtr.

Dla board detail kanały obejmują:

- `group_posts` (`filter: board_id=eq.{id}`),
- `group_comments` (`filter: board_id=eq.{id}`),
- `boards` (`filter: id=eq.{id}`),
- `board_moderators` (`filter: board_id=eq.{id}`).

## 3.4.2 Filtrowanie eventów

Filtrowanie po `board_id` i `id` ogranicza szum eventowy i liczbę niepotrzebnych refetchy. W modułach listowych (`BoardsRealtimeBridge`) stosowane są szersze subskrypcje i pełny refresh list.

## 3.4.3 Integracja z Context

Subskrypcje są częścią lifecycle `useEffect` kontekstów. Event nie modyfikuje bezpośrednio lokalnej kolekcji, lecz planuje refetch przez timer debounce.

Zaleta: niższe ryzyko niespójności przy złożonych mutacjach (post + komentarze + metadane).

Wada: więcej zapytań HTTP niż w modelu strict event patching.

## 3.4.4 Cleanup subskrypcji

W każdym module realtime istnieje cleanup:

- `supabase.removeChannel(channel)`,
- `clearTimeout` timerów,
- anulowanie reconnect timerów.

To krytyczne dla uniknięcia podwójnych subskrypcji po zmianie trasy.

## 3.4.5 Reconnect strategy

`BoardDetailContext` obsługuje statusy kanału (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) i uruchamia fallback reload po 1 sekundzie:

- reload postów,
- reload detalu tablicy,
- reload moderatorów.

To zapewnia samonaprawę stanu po utracie połączenia.

## 3.4.6 Zapobieganie duplikacji eventów

Stosowane są techniki:

- mapowanie rekordów po `id` przy merge,
- `reconcileOptimisticPosts` dla temp i server row,
- debounce odświeżenia eventów,
- throttling dodawania komentarzy (350 ms).

## 3.4.7 Integracja z optimistic UI

Mechanizm realtime nie zastępuje optimistic update; działa jako warstwa weryfikacyjna i synchronizująca między klientami. W przypadku lokalnego sukcesu optimistic wpis jest podmieniany odpowiedzią API, a późniejsze eventy nie powinny duplikować danych dzięki merge po identyfikatorach.

## 3.4.8 Edge cases

Obsługiwane sytuacje graniczne:

- token realtime niedostępny → brak subskrypcji, system działa w trybie polling-on-demand,
- abort requestu (zmiana route) → cicha ścieżka bez błędu użytkownika,
- utrata kanału → reconnect fallback,
- event burst → debounce timer.

---

## 3.5 System autoryzacji i bezpieczeństwa

## 3.5.1 Uwierzytelnianie

System oferuje dwa mechanizmy:

1. **Email + hasło**
   - walidacja loginu przez Zod,
   - weryfikacja hashu bcrypt,
   - utworzenie sesji z TTL 24h.

2. **Magic link**
   - losowy token 32B,
   - przechowywanie hashu SHA-256,
   - TTL (60 min), jednokrotne użycie,
   - walidacja tokenu i utworzenie sesji.

Sesja przechowywana jest jako httpOnly cookie (`sameSite=lax`, `secure` w produkcji).

## 3.5.2 Model ról: Owner / Moderator / Member

W module tablic role są wyliczane z relacji:

- **Owner**: `groups.created_by == userId`,
- **Moderator**: wpis w `board_moderators`,
- **Member**: wpis w `board_members`.

`canModerate = isOwner || isModerator`.

## 3.5.3 RLS i polityki (SELECT/INSERT/UPDATE/DELETE)

Migracje `0007`, `0035`, `0037`, `0039`, `0040` definiują polityki dla:

- `groups`, `group_members`,
- `boards`, `group_posts`, `group_comments`,
- `board_moderators`, `board_members`.

Przykłady reguł:

- select boards tylko dla członków tablicy,
- insert post/comment tylko dla członka tablicy,
- delete post/comment dla autora, ownera lub moderatora,
- modyfikacja tablicy dla ownera lub moderatora,
- zarządzanie `board_members` ograniczone do ownera grupy.

Wielokrotnie stosowane jest `FORCE ROW LEVEL SECURITY`.

## 3.5.4 Ochrona dynamicznych route

Ochrona realizowana jest dwupoziomowo:

1. `app/dashboard/layout.tsx` – redirect niezalogowanego użytkownika,
2. endpointy API – twarda autoryzacja i walidacja członkostwa.

Sama dynamiczna strona board detail nie wykonuje serwerowego `notFound` dla braku dostępu; decyzja jest odkładana do API i stanu kontekstu (`activeBoardStatus`).

## 3.5.5 Walidacja serwerowa i ochrona przed manipulacją ID

Mechanizmy ochronne:

- regex UUID dla parametrów,
- fallback dla `groupId` jako UUID/slug,
- ograniczanie długości treści,
- bezpośrednie sprawdzanie membership w SQL joinach,
- brak zaufania do danych przekazanych z klienta (np. `author_id` ustawiane serwerowo).

## 3.5.6 Ochrona przed nieautoryzowanym dostępem

Dostęp do rekordów tablicowych jest warunkowany członkostwem. Nawet jeśli klient odgadnie `boardId`, endpoint i polityka DB powinny zwrócić brak dostępu.

Ważny element: endpoint realtime-token wystawia JWT dla aktualnie zalogowanego użytkownika i roli `authenticated`, co wiąże subskrypcje realtime z kontekstem użytkownika.

---

# 4. Moduł Tablic (Boards)

## 4.1 Multi-board per group

Migracja `0037_multi_boards_per_group.sql` przekształciła model z pojedynczej tablicy grupowej (`group_boards`) do pełnego modelu N tablic na grupę. Skutki architektoniczne:

- niezależne osie dyskusji per board,
- granularne członkostwo i moderacja,
- możliwość różnicowania kontekstu podróży per board.

## 4.2 Struktura URL

Główne trasy:

- `/dashboard/boards` – agregat grup,
- `/dashboard/boards/{groupId}` – lista tablic grupy,
- `/dashboard/boards/{groupId}/{boardId}` – szczegóły tablicy.

`groupId` może być UUID lub slug; endpointy potrafią rozpoznać oba warianty.

## 4.3 Tworzenie tablic

`POST /api/boards/{groupId}`:

- wymaga ownera grupy,
- tworzy tablicę z domyślnymi polami travel info,
- inicjalizuje strukturę danych pod timeline,
- po stronie UI używany jest optimistic placeholder (`temp-board-*`).

## 4.4 Zarządzanie moderatorami

Moderacja oparta o `board_moderators`:

- owner dodaje/usuwa moderatora,
- moderator uzyskuje rozszerzone uprawnienia usuwania i aktualizacji,
- trigger cleanup usuwa uprawnienia przy usunięciu członka grupy.

## 4.5 Timeline i komentarze

Posty i komentarze mają:

- sortowanie po czasie,
- cursor-based pagination,
- podział UI na dni (`groupPostsByDay`),
- ładowanie komentarzy per post z limitem.

To pozwala zachować responsywność przy rosnącej liczbie rekordów.

## 4.6 Realtime synchronizacja

W aktywnej tablicy subskrybowane są cztery strumienie zmian. Odróżniono:

- reload postów/komentarzy,
- reload danych tablicy,
- reload listy moderatorów.

Dzięki separacji eventów UI nie wykonuje niepotrzebnych pełnych odświeżeń wszystkich zasobów.

## 4.7 Edge cases modułu

Obsługiwane przypadki:

- użytkownik traci uprawnienia w trakcie sesji,
- tablica znika (delete) przy otwartym widoku,
- wielokrotne szybkie dodawanie komentarzy,
- odświeżenie listy członków po eventach `board_members`.

## 4.8 Cleanup przy zmianie route

`BoardDetailClient` i `BoardDetailContext`:

- abortują żądania bootstrap i mutacje,
- czyszczą kanały realtime,
- resetują stan aktywnej tablicy.

To zapobiega „ghost update” po opuszczeniu widoku.

## 4.9 Separacja kontekstów

`BoardsContext` i `BoardDetailContext` mają rozdzielone odpowiedzialności:

- listy i operacje agregacyjne (groups/boards) vs
- pojedyncza tablica + timeline + komentarze + moderacja.

Taka separacja obniża coupling i redukuje koszty renderowania globalnego.

---

# 5. Zarządzanie stanem i wydajność

## 5.1 Stabilizacja context value

Każdy kontekst eksportuje `value` opakowany w `useMemo`. Funkcje mutacyjne i fetchujące są `useCallback`, co ogranicza zmianę referencji i re-render potomków.

Dla złożonych ekranów (board detail) to warunek konieczny, bo liczba zależnych komponentów jest wysoka.

## 5.2 useMemo / useCallback

Praktyczne zastosowania:

- grupowanie postów po dniach (`postsByDay`),
- mapowanie uczestników,
- filtrowanie kandydatów zaproszeń,
- stabilizacja funkcji akcji UI.

Korzyść: mniejsza liczba przebudów i spójniejsze działanie w Strict Mode.

## 5.3 Zapobieganie infinite render

Mechanizmy anty-pętlowe:

- ograniczenie zależności efektów,
- separacja state refs od state renderowego,
- guards w efektach (`if (!activeBoard?.id) return`),
- bezpośrednie użycie refów dla cursorów/in-flight.

W projekcie istnieją ślady diagnostyczne (`console.count('BoardDetailClient render')`), co wskazuje na aktywną kontrolę zjawiska nadmiernych renderów.

## 5.4 Strict Mode considerations

`next.config.js` ma `reactStrictMode: true`. Konsekwencją są podwójne wywołania efektów w dev, co wymaga:

- idempotentnego cleanupu,
- bezpiecznego zakładania kanałów,
- jawnego anulowania timerów i kontrolerów abort.

Kod kontekstów spełnia te założenia.

## 5.5 Cleanup efektów

Cleanup obejmuje:

- `removeChannel` dla każdego kanału,
- `clearTimeout` i `clearInterval`,
- `abort()` dla fetch i mutacji,
- reset lokalnych struktur pomocniczych.

To minimalizuje memory leaks i cross-route state bleed.

## 5.6 AbortController

AbortController jest stosowany konsekwentnie:

- bootstrap data load,
- operacje mutujące w komponentach,
- przejścia route.

Przerwane operacje nie są traktowane jako błędy użytkownika (`AbortError` ignorowany), co poprawia UX i jakość logów.

## 5.7 Debounce / throttle

Wydajnościowe zabezpieczenia:

- debounce reloadów realtime (~120 ms),
- throttle dodawania komentarza (350 ms),
- ograniczanie limitów paginacji.

Efekt: redukcja „event storms” i mniejsze obciążenie endpointów.

## 5.8 Lazy loading

Lazy loading realizowany jest logicznie (dane), nie przez code splitting modułów kontekstowych:

- początkowo ładowana tylko pierwsza strona postów,
- komentarze doładowywane na żądanie,
- kolejne strony postów przez `nextCursor`.

---

# 6. Skalowalność systemu

## 6.1 Zachowanie przy dużej liczbie użytkowników

Silne strony:

- ograniczone payloady dzięki paginacji,
- filtrowane kanały realtime,
- indeksy na kluczowych osiach (`board_id`, `created_at`).

Ryzyka:

- duża liczba kanałów per klient przy wielu otwartych modułach,
- częste refetch po eventach zamiast patch delta,
- endpointy SQL-heavy bez cache warstwy.

## 6.2 Zachowanie przy wielu postach

Cursor-based pagination skaluje się lepiej niż offset. Potencjalne bottlenecks pojawią się przy:

- zbyt szerokich selectach z joinami profili/użytkowników,
- jednoczesnych burstach komentarzy na jednej tablicy,
- wysokiej częstotliwości realtime refresh.

## 6.3 Bottlenecks

1. **Warstwa API** – wiele endpointów wykonuje ręczne SQL i mapowanie, co zwiększa koszt utrzymania.
2. **Realtime refresh strategy** – refetch zamiast event-level patch może generować nadmiar ruchu.
3. **Brak globalnego cache aplikacyjnego** – każde odświeżenie idzie do DB.
4. **Mieszany model schematu** – `src/db/schema.ts` nie jest w pełni zgodny z aktualnym modelem boardów, co zwiększa ryzyko regresji przy zmianach.

## 6.4 Indeksy i ich rola

Aktualne indeksy pokrywają najważniejsze scenariusze. Dalsze kroki (przy wzroście skali):

- composite indeksy pod konkretne zapytania sortujące z warunkami,
- analiza planów zapytań `EXPLAIN ANALYZE` dla endpointów listowych,
- ewentualna denormalizacja metryk `post_count` i `last_activity`.

## 6.5 Możliwości dalszej optymalizacji

- batchowanie reloadów po eventach realtime,
- wprowadzenie cache warstwy odczytowej (np. Redis) dla list agregacyjnych,
- dedykowany read model dla dashboardu,
- partial hydration payloadów komentarzy.

## 6.6 Potencjalny cache layer

Kandydaci do cache:

- `/api/boards` (agregat grup),
- `/api/boards/{groupId}` (listy tablic),
- profile autorów postów/komentarzy.

W module realtime cache musi być invalidowany zdarzeniowo, aby nie osłabić świeżości danych.

## 6.7 Możliwe rozdzielenie warstw

Przy dalszym wzroście funkcjonalnym rekomendowane kierunki:

1. wydzielenie warstwy services dla boards,
2. unifikacja dostępu do danych (repozytoria vs SQL inline),
3. opcjonalny podział runtime: API BFF + worker dla zadań asynchronicznych (cleanup, notyfikacje).

---

# 7. Problemy techniczne i ich rozwiązania

## 7.1 Race conditions

Przypadki wyścigów występują głównie przy:

- równoległym ładowaniu i mutacjach,
- zmianie trasy podczas requestu,
- nałożeniu eventu realtime na optimistic update.

Rozwiązania:

- `AbortController` + ignore `AbortError`,
- flagi in-flight (`loadPostsInFlightRef`),
- debounced refresh zamiast bezpośredniej mutacji stanu.

## 7.2 Duplikacja optimistic + realtime

Ryzyko: post widoczny raz jako `temp-*`, drugi raz po eventach DB.

Mitigacja:

- podmiana wpisu optimistic odpowiedzią API,
- reconciliation po `id` i cechach semantycznych,
- mapowanie wyników przez `Map` przy merge.

## 7.3 Crash Turbopack / infinite render

W projekcie istnieje świadoma diagnostyka renderów oraz defensywna stabilizacja referencji. Potencjalne źródła niestabilności:

- zależności efektów z obiektami tworzonymi inline,
- update context value bez memo.

Stosowane praktyki (memo/callback/ref guards) ograniczają ten problem.

## 7.4 Podwójne subskrypcje

Ryzyko w React Strict Mode: efekt może uruchomić się wielokrotnie w dev.

Mitigacja:

- lokalne referencje kanałów,
- cleanup `removeChannel`,
- `cancelled` flags i wyczyszczenie timerów.

## 7.5 Memory leaks

Potencjalne źródła:

- niewyczyszczone interwały/token refresh,
- wiszące requesty,
- pozostawione kanały realtime.

Rozwiązania obecne w kodzie:

- centralne cleanupy w `useEffect return`,
- abort kontrolery,
- reset struktur ref przy unmount.

## 7.6 Re-render storms

Źródła:

- event burst z realtime,
- duże context value i częste aktualizacje,
- szerokie drzewo komponentów zależne od jednego kontekstu.

Mitigacja:

- debounce reloadów,
- memoizacja pochodnych,
- separacja kontekstów domenowych.

---

# 8. Decyzje projektowe i kompromisy

## 8.1 Dlaczego wybrano konkretne podejście

### 8.1.1 Context API zamiast zewnętrznego store

Wybrano prostszy model natywny React, co obniża koszt wejścia i utrzymania. Dla obecnej skali modułów decyzja jest uzasadniona, choć przy dalszym wzroście złożoności może wymagać rewizji.

### 8.1.2 SQL inline w endpointach boards

Zastosowano ręczne SQL dla precyzyjnej kontroli joinów, paginacji i warunków dostępu. To przyspiesza dostarczanie funkcji, ale zmniejsza spójność warstwy data access.

### 8.1.3 Realtime jako „trigger reload”, nie patch engine

Decyzja upraszcza logikę kliencką i ogranicza błędy synchronizacji kosztem dodatkowych requestów HTTP.

## 8.2 Alternatywne rozwiązania

1. pełny store eventowy (Redux Toolkit + normalized cache),
2. react-query/SWR z invalidacją kluczy,
3. backend service layer + DTO contracts,
4. patch-based realtime reducer.

Każde z nich zwiększa złożoność architektury i koszt refaktoru, ale może dać lepszą skalowalność i obserwowalność.

## 8.3 Konsekwencje architektury

Pozytywne:

- szybki development funkcji produktowych,
- dobra czytelność lokalnej logiki ekranów,
- wysoka elastyczność SQL.

Negatywne:

- ryzyko dryfu między schematem Drizzle a SQL runtime,
- rozproszona logika autoryzacji między endpointami,
- większa trudność pełnej standaryzacji testów kontraktowych.

## 8.4 Kompromisy wydajność vs prostota

- **Wybrano prostotę klienta** (reload po eventach) zamiast maksymalnej wydajności patch-level.
- **Wybrano prostotę infrastrukturalną** (brak dedykowanego cache) kosztem dodatkowego obciążenia bazy przy skali.

## 8.5 Kompromisy bezpieczeństwo vs elastyczność

- Zaostrzono kontrolę dostępu (membership checks + RLS) kosztem bardziej rozbudowanego SQL i większej liczby polityk.
- Utrzymano kompatybilność UUID/slug dla części tras, co zwiększa elastyczność migracji, ale podnosi koszt walidacji i testowania.

---

# 9. Gotowość produkcyjna

## 9.1 Stabilność systemu

Elementy pozytywne:

- kontrola sesji i autoryzacji,
- stabilizacja stanów klienta (abort/cleanup/memo),
- paginacja cursor-based,
- RLS i constraints DB,
- mechanizmy samonaprawy po błędach kanałów realtime.

Obszary ryzyka:

- częściowy dualizm modelu danych (`src/db/schema.ts` vs aktualne migracje SQL dla boards),
- punktowe użycie logowania debugowego w endpointach,
- brak jednolitej warstwy observability (metryki, tracing).

## 9.2 Bezpieczeństwo

System spełnia kluczowe wymagania warstwy aplikacyjnej:

- auth cookie httpOnly,
- walidacja payloadów,
- server-side authorization,
- role owner/moderator/member,
- polityki RLS w bazie.

Dla produkcji zalecane:

- audyt kompletności polityk dla wszystkich tabel public,
- centralny rate limiting endpointów auth i mutacji,
- pełna polityka CORS/CSRF zgodna z modelem deploymentu.

## 9.3 Możliwość wdrożenia

Projekt posiada standardowe skrypty:

- `npm run build`,
- `npm run start`,
- `npm run test`,
- `npm run typecheck`.

Warunkiem poprawnego wdrożenia jest spójna konfiguracja:

- `DATABASE_URL`,
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`,
- `SUPABASE_JWT_SECRET`,
- (opcjonalnie) SMTP dla magic linków.

## 9.4 Wymagania infrastrukturalne

Minimalny zestaw:

- runtime Node.js dla Next.js,
- PostgreSQL (preferencyjnie Supabase),
- kanał websocket dla realtime,
- storage sekretów środowiskowych.

Dodatkowe elementy rekomendowane:

- narzędzia monitoringu i alertingu,
- cykliczny cleanup offline statusów (skrypt `backend-cleanup.ts` / cron),
- backup i plan rollback migracji.

## 9.5 Możliwości dalszego rozwoju

Kierunki rozbudowy:

1. formalizacja warstwy services dla boards,
2. rozszerzenie testów integracyjnych API,
3. telemetry i tracing,
4. cache read model,
5. modularizacja dużych komponentów klienckich.

---

# 10. Podsumowanie techniczne

## 10.1 Mocne strony stacku

- nowoczesny stack Next.js + React + TypeScript,
- dobrze rozwinięty model realtime oparty o PostgreSQL publication,
- solidny model uprawnień owner/moderator/member,
- cursor-based pagination i indeksowanie krytycznych zapytań,
- świadome praktyki stabilizacji stanu klienckiego (memo, abort, cleanup, debounce).

## 10.2 Słabe strony

- brak pełnej jednorodności warstwy dostępu do danych,
- istniejący dług techniczny w synchronizacji definicji schematu runtime,
- duża objętość odpowiedzialności pojedynczych kontekstów/komponentów,
- ograniczona standaryzacja walidacji schematowej poza wybranymi endpointami.

## 10.3 Ocena architektury

Architektura systemu jest dojrzała funkcjonalnie i adekwatna do produktu typu collaborative web app. Projekt poprawnie łączy:

- model request-response,
- realtime synchronization,
- autoryzację wielopoziomową,
- relacyjny model danych.

Największą wartość techniczną stanowi praktyczna implementacja współdzielonej tablicy z eventual consistency i kontrolą dostępu per zasób.

## 10.4 Przydatność jako system skalowalny

W aktualnej formie system nadaje się do wdrożeń produkcyjnych klasy small/medium scale. Dla skali większej konieczne będą działania wzmacniające:

- unifikacja warstwy danych,
- optymalizacja strategii realtime-refresh,
- rozszerzenie obserwowalności i testów.

Mimo tych obszarów do poprawy, obecna architektura stanowi solidną bazę do dalszego rozwoju, a poziom zaawansowania technicznego jest wystarczający do wykorzystania jako materiał źródłowy do pracy inżynierskiej (część technologiczno-architektoniczna).

---

## Aneks A. Diagramy opisane tekstowo

### A.1 Diagram przepływu żądania utworzenia komentarza

1. UI (`BoardDetailClient`) wysyła akcję komentarza.
2. `BoardDetailContext.createComment` tworzy `temp-comment-*`.
3. `POST /api/boards/posts/{postId}/comments`.
4. Backend:
   - odczyt usera z sesji,
   - sprawdzenie membership board,
   - insert `group_comments`.
5. Odpowiedź API zastępuje komentarz tymczasowy.
6. Event `postgres_changes` na `group_comments` planuje reload postów.
7. Context scala rekordy i deduplikuje.

### A.2 Diagram uprawnień board update

1. Użytkownik wysyła update info tablicy.
2. API ustala `BoardAccess` (`owner`, `moderator`, `member`).
3. Jeśli `canModerate = false` -> 403.
4. Jeśli `canModerate = true` -> update `boards`.
5. Realtime event `boards` aktualizuje pozostałe klienty.

### A.3 Diagram lifecycle subskrypcji board detail

1. Mount widoku tablicy.
2. Fetch tokenu realtime.
3. `setAuth(token)`.
4. Utworzenie 4 kanałów (`posts/comments/board/moderators`).
5. Event -> debounce -> refetch.
6. Status `CHANNEL_ERROR`/`TIMED_OUT` -> reconnect timer.
7. Unmount -> remove channels + clear timers + abort requests.

---

## Aneks B. Rejestr kluczowych decyzji technicznych (skrót)

1. Przejście na multi-board per group (`0037`) – zwiększenie elastyczności domenowej.
2. Wprowadzenie board-level membership (`0040`) – dokładniejsza kontrola dostępu niż sam `group_members`.
3. Wprowadzenie moderatorów (`0039`) – delegowanie operacji administracyjnych.
4. Rezygnacja z profili slugowych na rzecz stabilnych identyfikatorów – uproszczenie routingu i integralności linków.
5. Token realtime wydawany przez backend (`/api/supabase/realtime-token`) – spójność modelu auth HTTP i websocket.

---

## Aneks C. Uwaga o źródłach modelu danych

Podczas analizy stwierdzono, że historyczny dump `db_schema_scan.sql` odzwierciedla starszy etap schematu (np. `boards` powiązane z `trip_id` bez pełnego modelu board/group). Bieżący model runtime modułu tablic wynika z migracji `travel-planner/drizzle/0034–0040` oraz aktualnych endpointów `app/api/boards/*`. 

Wnioski i rekomendacje:

1. źródłem kanonicznym dla modułu boards powinien być zestaw aktualnych migracji,
2. warto przeprowadzić synchronizację `src/db/schema.ts` z finalnym modelem SQL,
3. warto dodać testy kontraktowe potwierdzające zgodność endpointów z modelem DB.

---

## Aneks D. Szczegółowa specyfikacja warstwy API (boards/auth/user)

### D.1 Endpointy auth i sesji

#### D.1.1 `POST /api/auth/register`

**Cel operacji**:

- utworzenie nowego użytkownika,
- walidacja wejścia,
- utworzenie sesji post-rejestracja.

**Walidacja wejścia**:

- email: format regex,
- hasło: min. 6 znaków,
- username: min. 3, max 64,
- whitelist znaków username: `^[A-Za-z0-9_.-]+$`.

**Reguły biznesowe**:

- sprawdzenie unikalności email,
- sprawdzenie unikalności username case-insensitive (`public.users`, `public.profiles`),
- transakcyjne utworzenie rekordu użytkownika i profilu.

**Wynik**:

- `201` i ustawienie cookie sesyjnego (happy path),
- `409` przy konflikcie,
- `400/422` przy błędach walidacji,
- `500` przy błędzie infrastruktury.

#### D.1.2 `POST /api/auth/login`

**Cel operacji**: uwierzytelnienie i wydanie sesji.

**Walidacja wejścia**:

- Zod schema: email + hasło.

**Reguły biznesowe**:

- porównanie hasła (bcrypt),
- utworzenie sesji (`createSession`),
- best-effort update `profiles.online = true`.

**Obsługa wyjątków**:

- wykrywanie timeoutu DB (`isConnectTimeoutError`) mapowane na `503`.

#### D.1.3 `POST /api/auth/magic-link` oraz `POST /api/auth/magic-link/verify`

**Generowanie linku**:

- token losowy 32 bajty,
- hash SHA-256 jako trwały identyfikator,
- TTL (60 min),
- zapis metadanych żądania (`ip`, `user-agent`),
- wysyłka email lub fallback logging.

**Weryfikacja linku**:

- check: istnienie, `usedAt`, `expiresAt`, `userId`,
- oznaczenie użycia linku,
- utworzenie sesji,
- ustawienie cookie.

**Bezpieczeństwo**:

- do bazy trafia hash tokenu, nie token jawny,
- token jest jednorazowy,
- brak ujawniania czy konto istnieje (odpowiedź neutralna na etapie wysyłki linku).

#### D.1.4 `POST /api/auth/logout`

**Cel**:

- usunięcie sesji po tokenie,
- opcjonalna aktualizacja `profiles.online = false`,
- wyczyszczenie cookie.

**Uwagi techniczne**:

- endpoint zawiera logowanie debugowe, które należy ograniczyć na produkcji,
- operacja profile update jest wykonywana best-effort.

### D.2 Endpointy user

#### D.2.1 `GET /api/user/me`

Zwraca minimalny profil użytkownika aktualnie zalogowanego:

- `id`, `email`, `username`, `usernameDisplay`, `publicId`, `avatarUrl`, `backgroundUrl`.

#### D.2.2 `PATCH /api/user/me`

Obsługuje trzy klasy mutacji:

1. heartbeat online,
2. aktualizacja username,
3. aktualizacja background.

**Reguły**:

- mutacja heartbeat: update `profiles.online` i `last_online_at`,
- mutacja username: długość i wymagania semantyczne,
- mutacja background: nullable i best-effort persistence.

### D.3 Endpoint tokenu realtime

#### D.3.1 `GET /api/supabase/realtime-token`

**Funkcja**: wystawia JWT podpisany `HS256` dla użytkownika sesyjnego.

Payload obejmuje:

- `aud=authenticated`,
- `sub=user.id`,
- `role=authenticated`,
- `iat` i `exp`.

Token jest używany wyłącznie do autoryzacji subskrypcji realtime po stronie klienta.

### D.4 Endpointy boards – mapa funkcjonalna

#### D.4.1 Agregaty i listy

- `GET /api/boards` – lista grup z metrykami board/post activity,
- `GET /api/boards/{groupId}` – lista tablic dostępnych dla użytkownika w grupie.

#### D.4.2 Operacje lifecycle tablicy

- `POST /api/boards/{groupId}` – tworzenie tablicy (owner only),
- `GET /api/boards/{groupId}/{boardId}` – detail tablicy + uprawnienia,
- `DELETE /api/boards/{groupId}/{boardId}` – usunięcie tablicy (owner).

#### D.4.3 Info tablicy

- `PUT /api/boards/{groupId}/{boardId}/info` – aktualizacja nazwy i travel info,
- walidacja długości i typów pól,
- egzekucja `canModerate`.

#### D.4.4 Posty i komentarze

- `GET/POST /api/boards/{groupId}/{boardId}/posts`,
- `DELETE /api/boards/posts/{postId}`,
- `POST /api/boards/posts/{postId}/comments`,
- `GET /api/boards/posts/{postId}/comments` (dalsze strony),
- `DELETE /api/boards/comments/{commentId}`.

#### D.4.5 Członkowie i moderatorzy

- `GET/POST /api/boards/by-id/{boardId}/members`,
- `DELETE /api/boards/by-id/{boardId}/members/{userId}`,
- `GET/POST /api/boards/by-id/{boardId}/moderators`,
- `DELETE /api/boards/by-id/{boardId}/moderators/{userId}`,
- `POST /api/boards/by-id/{boardId}/leave`.

### D.5 Konsekwencje architektoniczne obecnej warstwy API

1. Reguły dostępu są poprawnie kontrolowane runtime, ale są rozproszone.
2. Duża część SQL jest utrzymywana bezpośrednio w endpointach.
3. Refaktoryzacja do service layer jest możliwa bez zmiany kontraktu REST.
4. Model endpointów jest gotowy do dokumentacji OpenAPI (brakuje formalizacji pliku spec).

---

## Aneks E. Macierz polityk RLS i semantyka uprawnień

### E.1 Założenia bezpieczeństwa danych

Model bezpieczeństwa składa się z dwóch warstw:

1. kontrola aplikacyjna (endpoint checks),
2. kontrola bazy (RLS).

Docelowo RLS pełni funkcję „ostatniej linii obrony” nawet w przypadku błędu aplikacyjnego.

### E.2 Macierz dla tabel grupowych i boardowych

#### E.2.1 `groups`

- SELECT:
   - `groups_select_public`: grupy nieprywatne,
   - `groups_select_member`: grupy, których użytkownik jest członkiem.
- INSERT:
   - `groups_insert_authenticated` (created_by = auth.uid).
- UPDATE:
   - `groups_update_owner`.
- DELETE:
   - `groups_delete_owner`.

#### E.2.2 `group_members`

- SELECT:
   - `group_members_select_self`,
   - `group_members_select_admin`.
- INSERT:
   - `group_members_insert_allowed` (owner/admin).
- UPDATE:
   - `group_members_update_admin`.
- DELETE:
   - `group_members_delete_self_or_admin`.

#### E.2.3 `boards`

- SELECT:
   - finalnie członkowie tablicy (`boards_select_member` po `board_members`).
- INSERT:
   - owner grupy i zgodność `created_by`.
- UPDATE:
   - owner lub moderator (`boards_update_owner_or_moderator`).
- DELETE:
   - owner grupy.

#### E.2.4 `board_members`

- SELECT:
   - self lub owner grupy.
- INSERT:
   - owner grupy, tylko użytkownik będący członkiem grupy.
- DELETE:
   - owner, bez możliwości usunięcia ownera.

#### E.2.5 `board_moderators`

- SELECT:
   - członkowie grupy/tablicy.
- INSERT/DELETE:
   - owner grupy.

#### E.2.6 `group_posts` i `group_comments`

- SELECT/INSERT:
   - członkostwo tablicowe (`board_members`).
- DELETE:
   - autor OR owner OR moderator.

### E.3 Korzyści wynikające z FORCE RLS

`FORCE ROW LEVEL SECURITY` wymusza stosowanie polityk także dla właściciela tabeli (z wyjątkiem superuserów i ról bypassujących RLS). W kontekście projektu oznacza to:

- mniejsze ryzyko nieautoryzowanego odczytu przez nieuwagę w zapytaniach,
- silniejsze granice tenantowe (group/board scope),
- większą odporność na błędy implementacyjne API.

### E.4 Ryzyka i luki do monitorowania

1. Nie wszystkie stare tabele mają równie szczegółowe polityki.
2. Część operacji odbywa się przez sesję aplikacyjną, a nie natywnie przez auth JWT Supabase dla całego API.
3. Potrzebny okresowy audyt `pg_policies` i testy bezpieczeństwa typu policy regression.

### E.5 Zalecane testy bezpieczeństwa RLS

1. Próba odczytu tablicy bez membership.
2. Próba insert komentarza przez użytkownika spoza tablicy.
3. Próba usunięcia postu przez zwykłego członka (nie autora).
4. Próba nadania moderacji przez nie-ownera.
5. Próba usunięcia ownera z `board_members`.

Wyniki powinny zawsze zwracać zero rekordów lub błąd `permission denied` zgodny z kanałem wykonania.

---

## Aneks F. Szczegółowa analiza przepływów danych i stanów przejściowych

### F.1 Bootstrap widoku board detail

Sekwencja inicjalizacji:

1. mount `BoardDetailClient`,
2. `clearBoardState()`,
3. równoległe `loadBoard()` i `loadPosts()` z jednym `AbortController`,
4. pobranie członków tablicy przez endpoint by-id,
5. uruchomienie realtime channels.

Wartość techniczna: odseparowanie bootstrapu od mutacji użytkownika redukuje ryzyko konfliktu stanów przy wolnym łączu.

### F.2 Status handling i nawigacja wymuszona

`activeBoardStatus` w kliencie steruje przepływem UX:

- `401` → toast + redirect `/login`,
- `403/404` → toast + redirect do listy tablic grupy.

To zapewnia konsekwencję semantyki dostępu między API a UI.

### F.3 Przepływ dodawania posta (warianty)

#### F.3.1 Happy path

1. optimistic insert,
2. response zawiera post,
3. temp zastąpiony rekordem docelowym,
4. eventual refresh z realtime potwierdza spójność.

#### F.3.2 Błąd HTTP

1. optimistic insert,
2. response z błędem,
3. rollback usuwający temp,
4. ustawienie `error` i prezentacja toast.

#### F.3.3 Abort

1. optimistic insert,
2. abort controller (route change),
3. usunięcie wpisu temp,
4. brak komunikatu błędu użytkownika.

### F.4 Przepływ dodawania komentarza

Specyfika:

- throttle 350 ms per post,
- optimistic append do listy komentarzy,
- merge comments po response.

Cel: redukcja duplikatów przy szybkim submit i niestabilnym łączu.

### F.5 Przepływ modyfikacji moderatorów

1. blokada równoległej mutacji (`memberMutationPendingId`),
2. request add/remove moderator,
3. odświeżenie listy moderatorów (payload lub fallback refresh),
4. toast sukces/błąd.

Istotne ograniczenia:

- brak możliwości modyfikacji własnej roli moderatora,
- brak możliwości usunięcia ownera.

### F.6 Przepływ aktualizacji info tablicy

`updateBoardName` i `updateTravelInfo` używają jednego endpointu info i spójnego modelu payloadu. Dzięki temu:

- zmniejszona liczba endpointów,
- jednolity punkt walidacji,
- prostsza synchronizacja realtime dla tabeli `boards`.

### F.7 Realtime refresh pipeline

Dla każdego eventu:

1. callback kanału,
2. `schedule*Reload` (debounce),
3. refetch danych przez API,
4. merge/reconcile,
5. render.

Pipeline preferuje spójność nad minimalny koszt sieci.

### F.8 Czyszczenie przy zmianie scope

Zmiana `groupId/boardId` skutkuje:

- anulowaniem bootstrapu,
- resetem state,
- ponownym bootstrapem nowego scope.

To uniemożliwia „przesączenie” danych między tablicami.

---

## Aneks G. Wydajność, profil obciążeń i rekomendacje tuningu

### G.1 Profil obciążeń – odczyt

Najczęstsze odczyty w module boards:

1. listy tablic grupowych,
2. lista postów z komentarzami limitowanymi,
3. członkowie i moderatorzy.

Punkt krytyczny: listowanie postów z równoległymi zapytaniami komentarzy per post (N+1 pattern). Dla umiarkowanych limitów (20 postów, 10 komentarzy) jest akceptowalne, ale przy wysokim throughput warto rozważyć agregację zapytania.

### G.2 Profil obciążeń – zapis

Najczęstsze zapisy:

- insert post,
- insert comment,
- update board info,
- insert/delete moderators/members.

Koszt zapisu jest relatywnie niski; większy koszt występuje po stronie wtórnych refetchy triggerowanych realtime.

### G.3 Realtime i koszt sieci

Model refresh-on-event generuje:

- większą liczbę żądań HTTP,
- mniejszą złożoność klienta,
- wyższą odporność na błędy payloadu eventowego.

Rekomendacje:

1. batching eventów dłuższym oknem (np. 200–300 ms przy dużym ruchu),
2. dedykowane endpointy delta (`since` timestamp),
3. limit jednoczesnych kanałów per widok.

### G.4 Optymalizacja SQL endpointu postów

Kierunki poprawy:

- pobieranie komentarzy jednym zapytaniem window function + grupowanie po stronie backendu,
- precomputed counters (`comments_count`),
- materialized last activity per board.

### G.5 Optymalizacja renderowania UI

Kierunki:

1. wirtualizacja list przy bardzo dużych timeline,
2. split komponentu `BoardDetailClient` na mniejsze moduły memoizowane,
3. stabilizacja props callback przez dedykowane hooki usługowe.

### G.6 Observability i SLO

Wdrożeniowo zaleca się monitorowanie:

- p95/p99 czasu odpowiedzi endpointów boards,
- częstotliwości reconnectów realtime,
- liczby eventów na kanał,
- liczby błędów 401/403/404,
- wskaźnika rollback optimistic update.

Wskaźniki te umożliwią ustalenie SLO dla modułu współpracy grupowej.

---

## Aneks H. Plan technicznego hardeningu i roadmapa refaktoryzacji

### H.1 Krótki horyzont (1–2 sprinty)

1. Synchronizacja `src/db/schema.ts` z migracjami `0034–0040`.
2. Usunięcie logów debugowych z endpointów auth/logout.
3. Dodatkowe testy endpointów boards (permissions + pagination cursors).
4. Ujednolicenie walidacji payloadów (Zod również dla mutacji boards).

### H.2 Średni horyzont (3–5 sprintów)

1. Wydzielenie service layer `boards.service`.
2. Przeniesienie SQL endpointowego do modułów domenowych.
3. Standaryzacja DTO i maperów response.
4. Wdrożenie telemetry request-level (trace id, correlation id).

### H.3 Długi horyzont (6+ sprintów)

1. Redukcja full refetch po realtime na rzecz patch/delta.
2. Warstwa cache read-model.
3. Możliwe wydzielenie API BFF do osobnego procesu.
4. Rozszerzenie modelu ról o granularne permissions.

### H.4 Kryteria akceptacji hardeningu

1. Zero regresji w kontrolach dostępu (testy kontraktowe).
2. Spadek p95 czasu ładowania board detail.
3. Spadek liczby reconnectów i podwójnych subskrypcji.
4. Utrzymanie spójności optimistic/realtime bez duplikatów.

### H.5 Efekt biznesowo-techniczny roadmapy

Po realizacji planu system osiągnie:

- wyższą przewidywalność runtime,
- lepszą skalowalność obsługi współpracy wieloużytkownikowej,
- mniejszy koszt utrzymania kodu i szybszy onboarding zespołu,
- gotowość do dalszego wzrostu funkcjonalnego bez wzrostu długu technicznego proporcjonalnego do liczby modułów.

---

## Aneks I. Mapa zależności komponentów, rejestr ryzyk i scenariusze awarii

### I.1 Mapa zależności komponentów frontendowych

#### I.1.1 Warstwa dashboard shell

Główna odpowiedzialność shella dashboardu:

- uruchomienie autoryzowanego layoutu,
- dystrybucja danych użytkownika (`user`) do komponentów layoutowych,
- utrzymanie nawigacji i kontenerów modułów.

Zależności techniczne:

1. `app/dashboard/layout.tsx` zależy od `lib/auth` (cookie -> user id),
2. `DashboardLayoutComp` konsumuje dane użytkownika i renderuje slot children,
3. moduły domenowe (boards/groups/trips) działają jako niezależne klientowe węzły funkcjonalne.

Konsekwencja: awaria jednego modułu domenowego nie musi unieruchamiać całego shella, o ile błąd nie propaguje się do globalnego layoutu.

#### I.1.2 Moduł boards – zależności wewnętrzne

Relacja komponentów:

- `BoardsClient` -> `useBoardsContext`,
- `GroupBoardsClient` -> `useBoardsContext` + route param,
- `BoardDetailClient` -> `useBoard` + `useGroupContext` + `useToast`.

`BoardDetailClient` jest jednocześnie komponentem prezentacyjnym i orkiestratorem interakcji UI. Najistotniejsze zależności techniczne:

1. `useBoard()` (operacje data + moderation + travel info),
2. `useGroupContext()` (lista członków grupy i kandydatów zaproszeń),
3. `getBrowserSupabase()` (subskrypcja `board_members` w samym komponencie),
4. route navigation (`router.replace`) dla ścieżek błędowych.

Skutek architektoniczny: komponent posiada wysoki „fan-in/fan-out”, więc wymaga ostrożnego rozbijania przy dalszej rozbudowie.

#### I.1.3 Konteksty i ich granice odpowiedzialności

`GroupContext`:

- źródło prawdy dla grup i zaproszeń,
- API do zarządzania członkami,
- kanały realtime `groups` i `group_invites`.

`BoardsContext`:

- agregaty tablic grupowych,
- tworzenie/usuwanie/opuszczanie tablic,
- bridge realtime dla list.

`BoardDetailContext`:

- aktywna tablica,
- timeline i komentarze,
- moderacja i aktualizacja info,
- reconnect strategy.

To rozdzielenie ogranicza promień oddziaływania zmian i ułatwia testowanie jednostkowe warstw stanu.

### I.2 Mapa zależności backendowych

#### I.2.1 Auth pipeline

Zależności:

1. endpoint auth -> `user.repository`/`session.repository`,
2. `session.repository` -> tabela `sessions`,
3. `lib/auth` -> `cookies()` + `session.repository`,
4. dashboard layout -> `lib/auth`.

Awaria któregoś elementu powoduje degradację dostępu do strefy prywatnej.

#### I.2.2 Boards pipeline

1. endpointy `app/api/boards/*` -> `getCurrentUserId`,
2. endpointy -> `sqlClient` (manual SQL),
3. endpointy by-id i szczegóły -> `_lib/moderation`,
4. `_lib/moderation` -> tabele membership/moderation.

Wysoka spójność semantyki uprawnień wynika z centralnych helperów moderacyjnych, ale część reguł nadal jest duplikowana na poziomie endpointów.

#### I.2.3 Realtime pipeline

1. `GET /api/supabase/realtime-token` -> user z sesji,
2. podpis JWT `HS256` z `SUPABASE_JWT_SECRET`,
3. klient ustawia auth dla supabase realtime,
4. kanały słuchają publication table changes.

Błąd w tym pipeline nie blokuje całej aplikacji (degradacja do request-response), ale obniża jakość współpracy wieloużytkownikowej.

### I.3 Rejestr ryzyk technicznych (risk register)

#### I.3.1 Ryzyko R-01: Dryf schematu runtime

**Opis**: rozbieżność między historycznymi artefaktami schemy a aktualnym modelem boardów.

**Skutek**:

- ryzyko błędnej migracji,
- ryzyko niezgodności typów aplikacyjnych,
- większy koszt onboardingu.

**Prawdopodobieństwo**: średnie.

**Wpływ**: wysoki.

**Mitigacja**:

1. synchronizacja `src/db/schema.ts` z migracjami,
2. automatyczny test zgodności migracji vs schemat,
3. dokument „single source of truth” dla modelu danych.

#### I.3.2 Ryzyko R-02: Re-render storm przy wzroście funkcji UI

**Opis**: pojedynczy duży komponent board detail może zwiększać koszt renderowania wraz z nowymi feature’ami.

**Mitigacja**:

- dalsze wydzielanie subkomponentów memoizowanych,
- profilowanie renderów React DevTools,
- ograniczanie przekazywania dużych obiektów przez props.

#### I.3.3 Ryzyko R-03: Nadmiar refetch po realtime

**Opis**: model debounce-refetch jest prosty, ale przy dużym ruchu rośnie liczba zapytań.

**Mitigacja**:

- wydłużenie okna debounce pod obciążeniem,
- endpoint delta,
- inteligentne filtrowanie eventów po typie operacji.

#### I.3.4 Ryzyko R-04: Rozproszona logika autoryzacyjna

**Opis**: część reguł uprawnień jest osadzona inline w wielu endpointach.

**Mitigacja**:

- centralne moduły `access-policy`/`permission service`,
- testy regresji uprawnień,
- checklista review dla nowych endpointów.

#### I.3.5 Ryzyko R-05: Niewystarczająca obserwowalność produkcyjna

**Opis**: brak pełnego stacku metryk i śledzenia utrudnia diagnostykę incydentów.

**Mitigacja**:

- metryki endpointowe,
- alarmy na błędy auth/realtime,
- correlation id i structured logs.

### I.4 Scenariusze awarii i procedury odzyskiwania

#### I.4.1 Awaria bazy danych (czasowa niedostępność)

Objawy:

- odpowiedzi 5xx/503,
- timeouty auth,
- niemożność mutacji.

Procedura:

1. przejście w tryb degradacji UX (komunikat o niedostępności),
2. retry z backoff dla operacji odczytu,
3. monitorowanie czasu przywrócenia bazy,
4. po przywróceniu – pełny refresh kontekstów.

#### I.4.2 Awaria realtime (kanały websocket)

Objawy:

- brak natychmiastowej synchronizacji między klientami,
- statusy kanału `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`.

Procedura:

1. reconnect timer,
2. fallback na odświeżenia HTTP,
3. odnowienie tokenu realtime,
4. re-subscribe kanałów.

System zachowuje funkcjonalność podstawową dzięki request-response.

#### I.4.3 Uszkodzony token sesji

Objawy:

- `401` przy wywołaniach API,
- redirect do `/login` w dashboardzie.

Procedura:

1. wyczyszczenie local state kontekstów,
2. wymuszenie ponownego logowania,
3. po logowaniu – pełny bootstrap stanu.

#### I.4.4 Konflikty membership po zmianach administracyjnych

Objawy:

- użytkownik traci dostęp do tablicy podczas aktywnej sesji,
- endpointy zwracają `403/404`.

Procedura:

1. klient wykrywa status i przenosi użytkownika do listy tablic,
2. context czyści stan aktywnej tablicy,
3. listy grup/tablic aktualizują się przez realtime lub refresh.

### I.5 Operacyjne KPI i progi alarmowe

#### I.5.1 KPI funkcjonalne

1. czas bootstrap board detail (p95),
2. czas publikacji posta do widoczności na drugim kliencie,
3. odsetek nieudanych mutacji post/comment,
4. liczba rollback optimistic update na 1000 operacji.

#### I.5.2 KPI infrastrukturalne

1. czas odpowiedzi DB p95,
2. liczba reconnectów realtime na użytkownika/godzinę,
3. odsetek błędów 5xx per endpoint,
4. zużycie połączeń DB i kolejka zapytań.

#### I.5.3 Progi alarmowe (przykład)

- p95 `GET /api/boards/{groupId}/{boardId}/posts` > 800 ms,
- reconnect realtime > 6/h/użytkownik,
- 5xx auth > 1% w oknie 5 min,
- rollback optimistic > 3% operacji.

### I.6 Zalecenia testowe dla ciągłej jakości

#### I.6.1 Testy kontraktowe API

1. walidacja schematu odpowiedzi endpointów boards,
2. walidacja status code per rola,
3. testy cursor pagination edge (ostatnia strona, pusty cursor, niepoprawny cursor).

#### I.6.2 Testy integracyjne uprawnień

Scenariusze:

- member próbuje usunąć cudzy post,
- moderator aktualizuje info tablicy,
- użytkownik spoza boarda pobiera listę postów,
- owner usuwa membera i traci on natychmiastowy dostęp.

#### I.6.3 Testy odpornościowe UI

1. wielokrotne szybkie submit komentarza,
2. route change w trakcie mutacji,
3. utrata i odzyskanie kanału realtime,
4. symulacja wolnego łącza i opóźnionych odpowiedzi.

### I.7 Wnioski końcowe aneksu

1. Architektura jest funkcjonalnie dojrzała i wykazuje dobre praktyki bezpieczeństwa i stabilności stanu.
2. Największe zyski jakościowe przyniesie standaryzacja warstwy danych oraz formalizacja testów uprawnień.
3. System jest przygotowany na rozwój, ale wymaga systematycznej redukcji punktowego długu technicznego przy dalszym skalowaniu.

---

## Aneks J. Checklista wdrożeniowa, utrzymaniowa i matryca odpowiedzialności technicznych

### J.1 Checklista „go-live readiness”

#### J.1.1 Konfiguracja środowiska

1. Zweryfikować ustawienie `DATABASE_URL` dla właściwego środowiska (staging/production).
2. Zweryfikować `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.
3. Zweryfikować sekrety SMTP dla magic link (lub świadomie zaakceptować fallback logging).
4. Potwierdzić brak wycieku `.env.local` do repozytorium.

#### J.1.2 Migracje i integralność schematu

1. Wykonać backup bazy przed migracją.
2. Zastosować migracje SQL w kolejności wersji.
3. Zweryfikować obecność tabel i indeksów krytycznych (`boards`, `board_members`, `board_moderators`, `group_posts`, `group_comments`).
4. Zweryfikować polityki RLS (`pg_policies`) i `FORCE ROW LEVEL SECURITY`.
5. Zweryfikować publication `supabase_realtime` dla tabel boardowych.

#### J.1.3 Walidacja runtime

1. Test auth: register/login/logout/magic-link.
2. Test board flow: create board, create post, add comment, update info, add/remove moderator.
3. Test permissions: member vs moderator vs owner.
4. Test realtime: propagacja zmian między dwoma sesjami użytkownika.
5. Test fallback: działanie przy chwilowym braku realtime.

#### J.1.4 Wydajność i obserwowalność

1. Włączyć metryki czasu odpowiedzi endpointów boards.
2. Ustawić alerty dla 5xx i reconnectów realtime.
3. Ustawić dashboard operacyjny dla kluczowych KPI.
4. Włączyć retencję logów z anonimizacją danych wrażliwych.

### J.2 Checklista utrzymaniowa (runbook)

#### J.2.1 Incydent: wzrost 5xx w endpointach boards

Kroki:

1. sprawdzić status DB i limity połączeń,
2. sprawdzić rozkład błędów per endpoint,
3. porównać z wdrożeniami z ostatnich 24h,
4. uruchomić rollback jeśli regresja powiązana z nową wersją,
5. potwierdzić odzyskanie KPI po interwencji.

#### J.2.2 Incydent: brak synchronizacji realtime

Kroki:

1. weryfikacja endpointu tokenu realtime,
2. weryfikacja poprawności `SUPABASE_JWT_SECRET`,
3. weryfikacja publication i statusu websocket,
4. tymczasowe zwiększenie częstotliwości polling/refetch,
5. analiza i zamknięcie incydentu z RCA.

#### J.2.3 Incydent: nieautoryzowany dostęp zgłoszony przez użytkownika

Kroki:

1. odtworzyć request i status role/membership,
2. zweryfikować polityki RLS dla danej tabeli,
3. zweryfikować warstwę endpoint checks,
4. uruchomić testy regresji permission,
5. wdrożyć poprawkę i monitorować.

### J.3 Matryca odpowiedzialności technicznych (RACI uproszczone)

#### J.3.1 Obszary odpowiedzialności

1. **Backend/API owner**
   - odpowiedzialność za endpointy, walidację i kontrakty,
   - odpowiedzialność za logiczną spójność autoryzacji.

2. **Database owner**
   - odpowiedzialność za migracje, RLS, indeksy, backup,
   - odpowiedzialność za plan optymalizacji zapytań.

3. **Frontend owner**
   - odpowiedzialność za konteksty, lifecycle subskrypcji, UX błędów,
   - odpowiedzialność za wydajność renderowania.

4. **DevOps/Platform owner**
   - odpowiedzialność za sekrety, monitoring, alerting, release pipeline,
   - odpowiedzialność za procedury rollback i disaster recovery.

5. **QA owner**
   - odpowiedzialność za testy permission i scenariusze realtime,
   - odpowiedzialność za testy regresji po migracjach.

#### J.3.2 Reguły przekazywania zmian między obszarami

1. Każda zmiana endpointów boardowych wymaga oceny wpływu na RLS.
2. Każda zmiana migracji wymaga oceny wpływu na contexty frontendowe.
3. Każda zmiana realtime wymaga testu wieloklientowego.
4. Każda zmiana auth wymaga testu pełnego cyklu sesji.

### J.4 Minimalny standard jakości dla kolejnych iteracji

1. Brak nowych endpointów bez walidacji wejścia.
2. Brak nowych tabel bez polityk RLS i indeksów pod ścieżki krytyczne.
3. Brak nowych subskrypcji realtime bez jawnego cleanup.
4. Brak nowych mutacji UI bez strategii rollback.
5. Brak releasu bez testu uprawnień owner/moderator/member.

### J.5 Finalny wniosek operacyjny

Po wdrożeniu checklist i standardów z aneksu J projekt może być utrzymywany w sposób przewidywalny i skalowalny organizacyjnie, nie tylko technologicznie. Dokumentacja ta pełni funkcję technicznego „contractu eksploatacyjnego” pomiędzy zespołami frontend, backend, database i platform, co znacząco obniża ryzyko regresji podczas dalszego rozwoju systemu.
