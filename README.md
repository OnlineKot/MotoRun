# 🏍️ MotoRun – Neon Moto Stunt

Uzależniająca, jednoprzyciskowa gra motocyklowa w przeglądarce (HTML5 Canvas).
Trzymaj, żeby robić salta nad przepaściami, buduj combo, zbieraj **TEOpoints**
i wydawaj je w sklepie **TFcard** — bez karty i bez weryfikacji.

> Mechanika inspirowana gatunkiem „endless moto stunt" (np. Rider). Cały kod
> i grafika są oryginalne — nie zawierają żadnych zasobów z gier komercyjnych.

## ▶ Jak uruchomić

To statyczna strona — nie wymaga budowania.

- **Lokalnie:** otwórz `index.html` w przeglądarce (albo `python3 -m http.server` i wejdź na `http://localhost:8000`).
- **GitHub Pages:** Settings → Pages → Branch `claude/motorun-teopoints-game-7hvs04` → katalog `/ (root)`.

## 🎮 Sterowanie

`klik myszy` / `dotyk` / `spacja` / `↑` — gaz i salto w powietrzu. Ląduj prosto!

## 🔥 Mechaniki angażujące (styl „Żappki")

- 💎 **Revive** — po crashu kontynuujesz przejazd za TEOpoints (koszt rośnie: 100, 200, 400…).
- 🎯 **Misje dzienne** — 3 misje/dzień (te same dla wszystkich), nagroda w TEOpoints.
- 🎡 **Koło Szczęścia** — jeden darmowy spin dziennie (TEO, JACKPOT, naklejki).
- 🏷️ **Kolekcja naklejek** — losowy drop po przejeździe; komplet = duża nagroda + nowy sezon.
- 🏅 **Osiągnięcia** — jednorazowe nagrody za kamienie milowe.
- 🏆 **Ranking** — globalna tablica wyników (Firestore).
- 🔥 **Seria dzienna (streak)** — rosnąca nagroda za codzienne granie.

Wszystkie nagrody trafiają do salda TEOpoints (TF CARD gdy połączony, inaczej lokalnie).

## 🪙 TEOpoints i 💳 TFcard

- TEOpoints zdobywasz za dystans, salta, perfekcyjne lądowania, monety i dzienną serię.
- W **TFcard** kupujesz skiny motocykla **płacąc wyłącznie TEOpointsami**.
- Zakupy są w 100% wirtualne — `requireCardVerification: false` w `js/config.js`.

## 🔗 Integracja z aplikacją bankową TF CARD (na żywo)

MotoRun synchronizuje TEOpoints z prawdziwym kontem gracza w **TF CARD**
(Firebase Firestore, projekt `tf-card`, dokument `tfcard/state`).

**Jak to działa:**
1. Na starcie moduł `js/teopoints.js` loguje się anonimowo do Firebase TF CARD.
2. Gracz klika **„💳 Połącz konto TF CARD"** i wpisuje swój **PIN** → po PIN-ie
   znajdujemy `uid` i zapamiętujemy go w `localStorage`.
3. Po połączeniu **źródłem prawdy dla salda staje się TF CARD**
   (`users.<uid>.teo`), a HUD pokazuje saldo na żywo (`onSnapshot`).
4. Nagroda za przejazd → dopis `teo_in` w historii TF CARD.
5. Zakup skiny / koszt → najpierw sprawdzamy saldo na serwerze, potem `teo_out`.
6. Bez połączenia gra działa na saldzie lokalnym (offline).

**Bezpieczeństwo danych TF CARD:**
- Zapisujemy **wyłącznie** przez field-path `users.${uid}.teo` oraz
  `users.${uid}.transactions.${txid}` — **nigdy** nie nadpisujemy całego
  dokumentu, więc konta innych użytkowników są nienaruszone.
- Nie ruszamy pól `balance`, `pin`, `name`, `subs` itd.
- `teo` nigdy nie spada poniżej 0.
- **Anti-cheat:** maksymalna nagroda na jeden przejazd =
  `ECONOMY.maxRewardPerRun` (domyślnie 5000) w `js/config.js`.
- Po stronie TF CARD nic nie trzeba zmieniać — punkty pojawią się
  w zakładce TEOpoints (saldo + historia).

> Konfiguracja Firebase TF CARD jest wpisana w `js/teopoints.js`. Klucze
> Firebase Web są publiczne z założenia — dostępu pilnują reguły Firestore.

### Ranking – reguły Firestore (projekt `tf-card`)

Ranking trzyma wyniki w kolekcji `motorun_scores/<uid>`. Dodaj regułę
(obok reguły na `tfcard/state`):

```
match /motorun_scores/{uid} {
  allow read: if true;                                  // ranking publiczny
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

## ⚙️ Konfiguracja (wszystko w `js/config.js`)

| Co | Gdzie wkleić | Bez tego |
|---|---|---|
| **Google Analytics** | `GA_MEASUREMENT_ID` = `G-XXXX…` | GA wyłączone, gra działa |
| **Microsoft Clarity** | `CLARITY_PROJECT_ID` = id z `clarity.ms/tag/…` | Clarity wyłączone |
| **Firebase + logowanie** | obiekt `FIREBASE` z konsoli Firebase | tryb offline (gość + localStorage) |

Dopóki są placeholdery, gra w pełni działa w trybie offline.

### Firebase – szybki start
1. [console.firebase.google.com](https://console.firebase.google.com) → nowy projekt.
2. Authentication → Sign-in method → włącz **Google** oraz **Anonymous**.
3. Firestore Database → Utwórz bazę.
4. Project Settings → Web app → skopiuj `firebaseConfig` do `js/config.js`.
5. Reguły Firestore: użyj `firestore.rules` z tego repo.

## 📊 Śledzone zdarzenia (GA4 + Clarity)

`game_start`, `game_over`, `crash`, `flip`, `coin_pickup`, `purchase`,
`select_skin`, `login`, `logout`, `daily_streak`.

## 📁 Struktura

```
index.html         # strona + osadzenie SDK
css/style.css      # neonowy wygląd
js/config.js       # ⚙️ wszystkie ID (GA, Clarity, Firebase, ekonomia)
js/analytics.js    # gtag + Clarity + helper Analytics.track()
js/auth.js         # Firebase Auth + sync profilu (Firestore)
js/economy.js      # TEOpoints + sklep TFcard
js/game.js         # silnik gry (fizyka, render)
js/main.js         # UI: menu, HUD, sklep, koniec gry
firestore.rules    # reguły bezpieczeństwa bazy
```
