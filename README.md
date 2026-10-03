# DentalHub (Clinic Flow Plus)

Jeden inbox plików dla lekarza pracującego w wielu gabinetach. Recepcja i pracownie wrzucają pliki przez link
**bez konta** (link tylko do wysyłania), lekarz dostaje powiadomienie bez danych wrażliwych i otwiera plik w 2 tapnięciach.

> **Tryb POC: bez danych pacjentów.** Dane pacjentów dopiero po Gate 1 (patrz `docs/gate1-checklist.md`).

Stos: TanStack Start (React 19, TS) + Supabase (Postgres + RLS + Storage), Web Push (VAPID), PWA.

## Uruchomienie

```sh
bun install --frozen-lockfile
bun run dev          # dev
bun run test         # vitest
bun run build
bun run start        # Node production server (after build)
```

## Zmienne środowiskowe (serwer)

| Zmienna | Po co |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | publiczna konfiguracja Supabase osadzana w buildzie przeglądarkowym |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | połączenie serwerowe; service-role wyłącznie po stronie serwera |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PKCS8`, `VAPID_SUBJECT` | Web Push |
| `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | e-mail jako kanał zapasowy (opcjonalnie) |
| `CRON_SECRET` | autoryzacja codziennego purge (ten sam sekret jako `CRON_SECRET` w GitHub Actions) |
| `CRON_SECRET_PREVIOUS` | opcjonalny poprzedni sekret podczas rotacji |

## Migracje bazy danych

SQL aplikacji i testy pgTAP znajdują się w `supabase/migrations/` i `supabase/tests/`; Supabase CLI jest źródłem prawdy dla nowych, pustych środowisk. Lokalny `supabase start`, `supabase db reset` i `supabase test db --local` wymagają Docker.

> **Uwaga:** migracje bazowe opisują pustą bazę. Nie uruchamiaj `supabase db push` na istniejącym projekcie, dopóki schemat i historia migracji projektu nie zostaną porównane; istniejący projekt może wymagać kontrolowanego oznaczenia migracji jako zastosowanych.

## Środowisko pilotażowe

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_PASSWORD='min-12-znakow' APP_URL=https://... \
  node scripts/seed-pilot.mjs
```
Tworzy „Gabinet Pilotażowy (POC)”, 3 konta (admin, lekarz, recepcja), link do wysyłania i **syntetyczny** pantomogram.

## Dokumentacja
- `AGENTS.md` – zasady architektury
- `docs/threat-model.md`, `docs/runbook-incident.md`, `docs/gate1-checklist.md`, `docs/e2e-test-plan.md`
