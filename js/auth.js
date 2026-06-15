/* =========================================================================
 *  MotoRun – Firebase Auth + chmurowa synchronizacja profilu
 *  Korzysta z Firebase compat SDK (ładowany w index.html).
 *  Jeśli Firebase nie jest skonfigurowany -> tryb GOŚĆ (tylko localStorage).
 * ========================================================================= */

window.Auth = (function () {
  const CFG = window.MOTORUN_CONFIG;
  let app = null, auth = null, db = null;
  let currentUser = null;
  let ready = false;
  const listeners = [];

  function emit() { listeners.forEach(function (fn) { fn(currentUser); }); }

  function init() {
    if (!CFG.isFirebaseEnabled || typeof firebase === "undefined") {
      console.info("[MotoRun] Firebase WYŁĄCZONY – gram jako gość (localStorage).");
      ready = true;
      emit();
      return;
    }
    try {
      app  = firebase.initializeApp(CFG.FIREBASE);
      auth = firebase.auth();
      try { db = firebase.firestore(); } catch (e) { db = null; }

      auth.onAuthStateChanged(function (user) {
        currentUser = user;
        ready = true;
        if (user) {
          window.Analytics.identify(user.uid, {
            login_method: user.isAnonymous ? "guest" : (user.providerData[0] && user.providerData[0].providerId) || "unknown"
          });
          window.Analytics.track("login", { method: user.isAnonymous ? "guest" : "google" });
        }
        emit();
      });
    } catch (e) {
      console.warn("[MotoRun] Błąd inicjalizacji Firebase:", e);
      ready = true;
      emit();
    }
  }

  return {
    init: init,
    onChange: function (fn) { listeners.push(fn); if (ready) fn(currentUser); },
    get user() { return currentUser; },
    get enabled() { return CFG.isFirebaseEnabled && typeof firebase !== "undefined"; },

    loginGoogle: function () {
      if (!auth) { alert("Logowanie chmurowe niedostępne – uzupełnij konfigurację Firebase w js/config.js."); return; }
      const provider = new firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider).catch(function (e) {
        console.warn("Google login error:", e);
        alert("Nie udało się zalogować przez Google: " + e.message);
      });
    },

    loginGuest: function () {
      if (!auth) { emit(); return Promise.resolve(); }
      return auth.signInAnonymously().catch(function (e) {
        console.warn("Anonymous login error:", e);
      });
    },

    logout: function () {
      window.Analytics.track("logout", {});
      if (auth) return auth.signOut();
      currentUser = null; emit();
      return Promise.resolve();
    },

    /* --- Chmura: zapis/odczyt profilu gracza (TEOpoints, skiny, rekord) --- */
    loadProfile: function () {
      if (!db || !currentUser) return Promise.resolve(null);
      return db.collection("players").doc(currentUser.uid).get()
        .then(function (doc) { return doc.exists ? doc.data() : null; })
        .catch(function () { return null; });
    },
    saveProfile: function (data) {
      if (!db || !currentUser) return Promise.resolve();
      return db.collection("players").doc(currentUser.uid)
        .set(data, { merge: true })
        .catch(function (e) { console.warn("saveProfile error:", e); });
    }
  };
})();
