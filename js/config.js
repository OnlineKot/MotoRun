/* =========================================================================
 *  MotoRun – KONFIGURACJA
 *  Tutaj wklej swoje prawdziwe ID. Dopóki są placeholdery,
 *  gra działa normalnie (tryb lokalny / gość) i nic nie wybucha.
 * ========================================================================= */

window.MOTORUN_CONFIG = {

  /* --- Google Analytics 4 (gtag.js) ---
   * Wklej swój Measurement ID, np. "G-ABCD123456".
   * Zostaw placeholder, jeśli jeszcze nie masz – analytics po prostu się nie włączy. */
  GA_MEASUREMENT_ID: "G-MS5ESGRE72",

  /* --- Microsoft Clarity ---
   * Wklej swój Project ID z kodu Clarity (ten ciąg z clarity.ms/tag/XXXXX).
   * Np. "abcd1234ef". */
  CLARITY_PROJECT_ID: "x7he4s6cjn",

  /* --- Firebase ---
   * Skopiuj obiekt z konsoli Firebase: Ustawienia projektu > Twoje aplikacje > Web.
   * Klucze Firebase Web są publiczne (to normalne) – bezpieczeństwo zapewniają reguły.
   * Dopóki tu są placeholdery, logowanie chmurowe jest wyłączone,
   * a gra działa w trybie offline (gość + localStorage). */
  FIREBASE: {
    apiKey:            "AIzaSyBZF27vUTccQRMlEHrBS4uN5PXi_ukNWyo",
    authDomain:        "tf-card.firebaseapp.com",
    projectId:         "tf-card",
    storageBucket:     "tf-card.firebasestorage.app",
    messagingSenderId: "1016438448701",
    appId:             "1:1016438448701:web:d692ca0812e5c0795e0054",
    measurementId:     "G-9BWVE69392"
  },

  /* --- TFcard / TEOpoints ---
   * requireCardVerification: false  ->  zakupy BEZ karty i BEZ weryfikacji.
   * Płacisz wyłącznie wirtualnymi TEOpointsami.
   *
   * UWAGA: gdy gracz połączy konto TF CARD (przez PIN), źródłem prawdy dla
   * salda TEOpoints staje się Firestore TF CARD (kolekcja tfcard/state).
   * Bez połączenia gra działa na lokalnym saldzie (localStorage). */
  ECONOMY: {
    requireCardVerification: false,
    startingTeopoints: 0,
    teopointsPerMeter: 0.5,     // ile TEO za metr dystansu
    teopointsPerFlip: 25,       // ile TEO za jedno salto
    perfectLandingBonus: 15,    // bonus za idealne lądowanie
    maxRewardPerRun: 5000       // ANTI-CHEAT: górny limit TEO za jeden przejazd
  }
};

/* Pomocnicze flagi – czy dany serwis jest realnie skonfigurowany */
window.MOTORUN_CONFIG.isGAEnabled =
  !window.MOTORUN_CONFIG.GA_MEASUREMENT_ID.includes("XXXX");
window.MOTORUN_CONFIG.isClarityEnabled =
  !window.MOTORUN_CONFIG.CLARITY_PROJECT_ID.includes("XXXX");
window.MOTORUN_CONFIG.isFirebaseEnabled =
  !window.MOTORUN_CONFIG.FIREBASE.apiKey.startsWith("REPLACE");
