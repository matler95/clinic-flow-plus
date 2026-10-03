# Plan testów end-to-end (ręcznie na urządzeniach; wymaga środowiska z kontami z `seed-pilot.mjs`)
1. Logowanie 3 kont (admin, lekarz, recepcja) – laptop + iPhone (PWA z ekranu głównego).
2. Link `/d/<token>`: wyślij JPG/PDF/DICOM → „Dostarczono” → plik w skrzynce lekarza; EXE/ZIP/TXT odrzucone.
3. Zrób zdjęcie dokumentu na telefonie (kamera) → dostarczone.
4. Otwórz plik u lekarza → u nadawcy pojawia się „Otwarto o …” (≤ 10 s).
5. Skrzynka gabinetu: recepcja przypisuje plik; lekarz przekazuje koledze z notatką.
6. Zastępstwo: ustaw okno dla lekarza A → plik na link A trafia do B z oznaczeniem „Zastępstwo za …”.
7. Powiadomienie push na telefonie (bez nazw plików); po wyłączeniu push – e-mail zapasowy (jeśli skonfigurowany).
8. Odebranie dostępu: dezaktywuj lekarza → brak dostępu natychmiast, pliki wracają do skrzynki gabinetu.
9. Duży plik ~50 MB (PDF/DICOM): czas wysyłki, pamięć przeglądarki, podgląd.
10. Retencja: ustaw `expires_at` w przeszłości → uruchom workflow *Retention purge* → obiekt zniknął ze Storage i bazy.
