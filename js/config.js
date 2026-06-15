/* =========================================================================
 *  MotoRun – KONFIGURACJA
 *  Tutaj wklej swoje prawdziwe ID. Dopóki są placeholdery,
 *  gra działa normalnie (tryb lokalny / gość) i nic nie wybucha.
 * ========================================================================= */

window.MOTORUN_CONFIG = {

  /* --- Google Analytics 4 (gtag.js) ---
   * Wklej swój Measurement ID, np. "G-ABCD123456".
   * Zostaw placeholder, jeśli jeszcze nie masz – analytics po prostu się nie włączy. */
  GA_MEASUREMENT_ID: "G-XXXXXXXXXX",

  /* --- Microsoft Clarity ---
   * Wklej swój Project ID z kodu Clarity (ten ciąg z clarity.ms/tag/XXXXX).
   * Np. "abcd1234ef". */
  CLARITY_PROJECT_ID: "XXXXXXXXXX",

  /* --- Firebase ---
   * Skopiuj obiekt z konsoli Firebase: Ustawienia projektu > Twoje aplikacje > Web.
   * Klucze Firebase Web są publiczne (to normalne) – bezpieczeństwo zapewniają reguły.
   * Dopóki tu są placeholdery, logowanie chmurowe jest wyłączone,
   * a gra działa w trybie offline (gość + localStorage). */
  FIREBASE: {
    apiKey:            "REPLACE_FIREBASE_API_KEY",
    authDomain:        "REPLACE.firebaseapp.com",
    projectId:         "REPLACE_PROJECT_ID",
    storageBucket:     "REPLACE.appspot.com",
    messagingSenderId: "REPLACE_SENDER_ID",
    appId:             "REPLACE_APP_ID",
    measurementId:     "G-XXXXXXXXXX"
  },

  /* --- TFcard / TEOpoints ---
   * requireCardVerification: false  ->  zakupy BEZ karty i BEZ weryfikacji.
   * Płacisz wyłącznie wirtualnymi TEOpointsami zdobytymi w grze. */
  ECONOMY: {
    requireCardVerification: false,
    startingTeopoints: 0,
    teopointsPerMeter: 0.5,     // ile TEO za metr dystansu
    teopointsPerFlip: 25,       // ile TEO za jedno salto
    perfectLandingBonus: 15     // bonus za idealne lądowanie
  }
};

/* Pomocnicze flagi – czy dany serwis jest realnie skonfigurowany */
window.MOTORUN_CONFIG.isGAEnabled =
  !window.MOTORUN_CONFIG.GA_MEASUREMENT_ID.includes("XXXX");
window.MOTORUN_CONFIG.isClarityEnabled =
  !window.MOTORUN_CONFIG.CLARITY_PROJECT_ID.includes("XXXX");
window.MOTORUN_CONFIG.isFirebaseEnabled =
  !window.MOTORUN_CONFIG.FIREBASE.apiKey.startsWith("REPLACE");
