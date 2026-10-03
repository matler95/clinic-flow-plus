# Model zagrożeń (skrót)

| Zagrożenie | Kontrola w kodzie | Status |
|---|---|---|
| Wyciek linku do wysyłania | write-only, token 256 bit, w bazie tylko SHA-256, `consume_drop_link` (atomowy limit), odnowienie/wyłączenie | zrobione |
| Złośliwy plik | allowlista MIME, weryfikacja magic bytes po uploadzie, brak inline HTML/SVG | zrobione; skan AV – brak (Etap 3) |
| Eskalacja między gabinetami | RLS, SECURITY DEFINER RPC, UPDATE tylko na `read_at/important/archived_at` | zrobione; testy pgTAP – do dodania |
| Wyciek przez powiadomienia | push bez payloadu, e-mail generyczny | zrobione |
| Manipulacja audytem | append-only (trigger + brak GRANT) – migracja 0001 | zrobione |
| Nadmierne przechowywanie | retencja 30 dni, purge storage→DB, sweep sierot, outbox 30 dni | zrobione; harmonogram w GitHub Actions |
| Odebrany dostęp | `is_active=false`, repatriacja plików, wygaszenie linków i zastępstw | zrobione |
| Nagłówki HTTP | nosniff, no-referrer, X-Frame-Options, HSTS, Permissions-Policy | zrobione; ścisły CSP – Gate 1 |
| Brute-force / spam w linku | limit użyć linku | brak limitu dziennego i Turnstile – Gate 1 |
