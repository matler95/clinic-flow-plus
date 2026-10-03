# Procedura incydentu (szkic do uzgodnienia z IOD)
1. **Wykrycie** – alert użytkownika, anomalia w `audit_log`, błąd purge/powiadomień.
2. **Ograniczenie** – odwołaj linki (`revokeDropLink`), dezaktywuj konta (`deactivate_member`), w razie potrzeby wyłącz bucket `files`.
3. **Ocena** – zakres: które organizacje/pliki (audit_log: `item.view_session_start`, `item.drop`).
4. **Zgłoszenie** – administrator danych (placówka) decyduje o zgłoszeniu do UODO w 72 h (art. 33 RODO); Hub jako podmiot przetwarzający informuje placówkę bez zbędnej zwłoki.
5. **Naprawa i wnioski** – rotacja sekretów (VAPID, cron, service role), wpis do rejestru incydentów.
