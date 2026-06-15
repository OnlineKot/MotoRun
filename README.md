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

## 🪙 TEOpoints i 💳 TFcard

- TEOpoints zdobywasz za dystans, salta, perfekcyjne lądowania, monety i dzienną serię.
- W **TFcard** kupujesz skiny motocykla **płacąc wyłącznie TEOpointsami**.
- Zakupy są w 100% wirtualne — `requireCardVerification: false` w `js/config.js`.

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
