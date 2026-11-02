# NewPlace – remont

Prosta lokalna aplikacja na linki do rzeczy na remont, inspiracje i kierunek designu. Dwa profile bez logowania (wybierasz u góry, kim jesteś).

## Uruchomienie (Docker)

```bash
docker compose up -d --build
```

Potem otwórz http://localhost:8080. Z telefonu w tej samej sieci: `http://<IP-komputera>:8080`.

Dane (baza `db.json` i wgrane zdjęcia) są w folderze `./data` – zrób jego kopię, żeby mieć backup.

## Bez Dockera

```bash
node server.js
```

Wymaga Node 18+. Nie ma zależności do instalowania.

## Co jest w środku

- **Pokoje** – kategorie (Łazienka, Szafa…), wklejasz link, a tytuł, zdjęcie i cena pobierają się same. Status (pomysł / shortlista / do kupienia / kupione), cena, notatka, serduszka od każdej osoby, suma kosztów.
- **Inspiracje** – zdjęcia z linku, pliku, przeciągnięcia lub Ctrl+V, przypisane do pokoju. Filtr „podoba się obojgu”.
- **Kierunek designu** – dla całego mieszkania i każdego pokoju: style, paleta kolorów (z podpowiedzią palety do stylu), materiały, notatki. Kierunek jest widoczny nad listą linków w pokoju. „Kopiuj brief” daje gotowy opis do wysłania projektantowi albo wklejenia do AI.
