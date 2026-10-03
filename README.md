# DentalHub (Clinic Flow Plus)

Jeden inbox plików dla lekarza pracującego w wielu gabinetach. Recepcja i pracownie wrzucają pliki przez link
**bez konta** (link tylko do wysyłania), lekarz dostaje powiadomienie bez danych wrażliwych i otwiera plik w 2 tapnięciach.

> **Tryb POC: bez danych pacjentów.** Dane pacjentów dopiero po Gate 1 (patrz `docs/gate1-checklist.md`).

Stos: TanStack Start (React 19, TS) + Lovable Cloud / Supabase (Postgres + RLS + Storage), Web Push (VAPID), PWA.

## Uruchomienie

```sh
npm i --legacy-peer-deps
npm run dev          # dev
npm test             # vitest
npm run build
```

## Zmienne środowiskowe (serwer)

| Zmienna | Po co |
|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PKCS8`, `VAPID_SUBJECT` | Web Push |
| `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | e-mail jako kanał zapasowy (opcjonalnie) |
| `LOVABLE_CRON_SECRET` | autoryzacja codziennego purge (ten sam sekret jako `CRON_SECRET` w GitHub Actions) |

## Środowisko pilotażowe

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_PASSWORD='min-12-znakow' APP_URL=https://... \
  node scripts/seed-pilot.mjs
```
Tworzy „Gabinet Pilotażowy (POC)”, 3 konta (admin, lekarz, recepcja), link do wysyłania i **syntetyczny** pantomogram.

## Dokumentacja
- `AGENTS.md` – zasady architektury
- `docs/threat-model.md`, `docs/runbook-incident.md`, `docs/gate1-checklist.md`, `docs/e2e-test-plan.md`
