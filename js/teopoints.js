/* =========================================================================
 *  MotoRun ↔ TF CARD – integracja waluty TEOpoints
 *  Firebase modular SDK ładowany z CDN (ESM) – działa BEZ bundlera.
 *
 *  Dane TF CARD: projekt "tf-card", Firestore, JEDEN dokument tfcard/state.
 *  TEOpoints gracza = users.<uid>.teo   |   historia = users.<uid>.transactions.<txid>
 *
 *  KRYTYCZNE: używamy field-path (users.${uid}.teo) i NIGDY nie nadpisujemy
 *  całego dokumentu – inaczej skasowalibyśmy konta innych użytkowników.
 *  Nie ruszamy pól balance / pin / name / subs itd.
 * ========================================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Ta sama konfiguracja co aplikacja TF CARD. */
const firebaseConfig = {
  apiKey: "AIzaSyBZF27vUTccQRMlEHrBS4uN5PXi_ukNWyo",
  authDomain: "tf-card.firebaseapp.com",
  projectId: "tf-card",
  storageBucket: "tf-card.firebasestorage.app",
  messagingSenderId: "1016438448701",
  appId: "1:1016438448701:web:d692ca0812e5c0795e0054",
  measurementId: "G-9BWVE69392"
};

const app = initializeApp(firebaseConfig, "tfcard");
const db  = getFirestore(app);
const ref = doc(db, "tfcard", "state");

/* Współdzielona instancja Firestore dla innych modułów (np. ranking). */
window.__MOTORUN_FB = { app: app, db: db };

const LS_UID  = "motorun_tf_uid";
const LS_NAME = "motorun_tf_name";
const MAX_REWARD_PER_RUN =
  (window.MOTORUN_CONFIG && window.MOTORUN_CONFIG.ECONOMY &&
   window.MOTORUN_CONFIG.ECONOMY.maxRewardPerRun) || 5000;

let uid     = localStorage.getItem(LS_UID)  || null;
let name    = localStorage.getItem(LS_NAME) || null;
let balance = 0;
let unsub   = null;

/* ---- niskopoziomowe API wg specyfikacji TF CARD ---- */

async function initTeo() { await signInAnonymously(getAuth(app)); }

/** Zwraca uid gracza po jego PIN-ie z TF CARD (albo null). */
async function findUserByPin(pin) {
  const snap = await getDoc(ref);
  const users = (snap.data() && snap.data().users) || {};
  const u = Object.values(users).find(function (x) { return x.pin === String(pin); });
  return u ? u.id : null;
}

async function getTeo(u) {
  const snap = await getDoc(ref);
  const d = snap.data();
  return (d && d.users && d.users[u] && d.users[u].teo) || 0;
}

/** Dodaj/odejmij punkty + wpis w historii. Tylko field-path, teo nigdy < 0. */
async function changeTeo(u, delta, title) {
  const cur  = await getTeo(u);
  const next = Math.max(0, Math.round(cur + delta));
  const txid = "t-" + Math.random().toString(36).slice(2, 10);
  const update = {};
  update["users." + u + ".teo"] = next;
  update["users." + u + ".transactions." + txid] = {
    type: delta >= 0 ? "teo_in" : "teo_out",
    title: title || (delta >= 0 ? "MotoRun — nagroda" : "MotoRun — koszt"),
    amount: Math.abs(Math.round(delta)),
    ts: Date.now()
  };
  await updateDoc(ref, update);
  return next;
}

/** Podgląd salda na żywo. Zwraca funkcję odsubskrybowania. */
function watchTeo(u, cb) {
  return onSnapshot(ref, function (s) {
    const d = s.data();
    cb((d && d.users && d.users[u] && d.users[u].teo) || 0);
  });
}

/* ---- warstwa wygodna dla gry (window.TFCard) ---- */

function startWatch() {
  if (unsub) { unsub(); unsub = null; }
  if (!uid) return;
  unsub = watchTeo(uid, function (n) {
    balance = n;
    window.dispatchEvent(new CustomEvent("tfcard-teo", { detail: { balance: n } }));
  });
}

async function connect(pin) {
  const found = await findUserByPin(pin);
  if (!found) return { ok: false, reason: "Nie znaleziono konta TF CARD dla tego PIN-u." };
  uid = found;
  const snap = await getDoc(ref);
  const d = snap.data();
  name = (d && d.users && d.users[uid] && d.users[uid].name) || "Gracz";
  balance = (d && d.users && d.users[uid] && d.users[uid].teo) || 0;
  localStorage.setItem(LS_UID, uid);
  localStorage.setItem(LS_NAME, name);
  startWatch();
  window.dispatchEvent(new CustomEvent("tfcard-connect", { detail: { uid: uid, name: name } }));
  if (window.Analytics) Analytics.track("tfcard_connect", { uid: uid });
  return { ok: true, name: name, balance: balance };
}

function disconnect() {
  if (unsub) { unsub(); unsub = null; }
  uid = null; name = null; balance = 0;
  localStorage.removeItem(LS_UID);
  localStorage.removeItem(LS_NAME);
  window.dispatchEvent(new CustomEvent("tfcard-disconnect"));
}

/** Nagroda za przejazd – z anti-cheatowym limitem na jeden przejazd. */
async function earn(amount, title) {
  amount = Math.round(amount);
  if (!uid || amount <= 0) return balance;
  const capped = Math.min(amount, MAX_REWARD_PER_RUN);
  try { return await changeTeo(uid, +capped, title); }
  catch (e) { console.warn("[TFCard] earn error:", e); return balance; }
}

/** Wydanie – najpierw sprawdza saldo na serwerze (autorytatywnie). */
async function spend(amount, title) {
  amount = Math.round(Math.abs(amount));
  if (!uid) return { ok: false, reason: "Brak połączonego konta TF CARD." };
  if (amount === 0) return { ok: true, balance: balance };
  try {
    const cur = await getTeo(uid);
    if (cur < amount) return { ok: false, reason: "Za mało TEOpoints na koncie TF CARD." };
    const next = await changeTeo(uid, -amount, title);
    return { ok: true, balance: next };
  } catch (e) {
    console.warn("[TFCard] spend error:", e);
    return { ok: false, reason: "Błąd połączenia z TF CARD." };
  }
}

window.TFCard = {
  ready: false,
  get connected() { return !!uid; },
  get uid() { return uid; },
  get name() { return name; },
  get balance() { return balance; },
  get authUid() { const u = getAuth(app).currentUser; return u ? u.uid : null; },
  connect: connect,
  disconnect: disconnect,
  earn: earn,
  spend: spend,
  // niskopoziomowe API (zgodne ze specyfikacją):
  findUserByPin: findUserByPin,
  getTeo: getTeo,
  changeTeo: changeTeo,
  watchTeo: watchTeo
};

/* =========================================================================
 *  LOGOWANIE (Google + e-mail/hasło) na tym samym projekcie tf-card.
 *  To ono daje dostęp do Firestore (reguły wymagają zalogowania), więc po
 *  usunięciu logowania anonimowego TEOpoints działają po zalogowaniu.
 *  window.Auth – używane przez economy.js (profil w chmurze: skiny, rekord).
 * ========================================================================= */
const auth = getAuth(app);
let authUser = null;

function profileRef(u) { return doc(db, "players", u); }

window.Auth = {
  get user() { return authUser; },
  get enabled() { return true; },
  init: function () {},
  onChange: function (fn) { authListeners.push(fn); if (authReady) fn(authUser); },

  loginGoogle: function () {
    return signInWithPopup(auth, new GoogleAuthProvider())
      .catch(function (e) { alert("Logowanie Google nie powiodło się: " + e.message); throw e; });
  },
  loginEmail: function (email, pass) {
    return signInWithEmailAndPassword(auth, email, pass);
  },
  registerEmail: function (email, pass) {
    return createUserWithEmailAndPassword(auth, email, pass);
  },
  resetPassword: function (email) {
    return sendPasswordResetEmail(auth, email);
  },
  loginGuest: function () { return signInAnonymously(auth); }, // działa tylko gdy Anonymous włączone
  logout: function () {
    if (window.Analytics) Analytics.track("logout", {});
    return signOut(auth);
  },

  loadProfile: function () {
    if (!authUser) return Promise.resolve(null);
    return getDoc(profileRef(authUser.uid))
      .then(function (d) { return d.exists() ? d.data() : null; })
      .catch(function () { return null; });
  },
  saveProfile: function (data) {
    if (!authUser) return Promise.resolve();
    return setDoc(profileRef(authUser.uid), data, { merge: true })
      .catch(function (e) { console.warn("saveProfile error:", e); });
  }
};

const authListeners = [];
let authReady = false;
onAuthStateChanged(auth, function (u) {
  authUser = u;
  authReady = true;
  if (u) {
    if (window.Analytics) {
      const method = u.isAnonymous ? "guest" : ((u.providerData[0] && u.providerData[0].providerId) || "password");
      window.Analytics.identify(u.uid, { login_method: method });
      window.Analytics.track("login", { method: method });
    }
    // mając dostęp do Firestore, wznów podgląd salda jeśli konto TF CARD połączone
    if (uid) startWatch();
  }
  authListeners.forEach(function (fn) { fn(authUser); });
  window.dispatchEvent(new CustomEvent("tfcard-auth", { detail: { user: u ? { uid: u.uid, email: u.email, name: u.displayName, anon: u.isAnonymous } : null } }));
});

/* Start: spróbuj logowania anonimowego (działa, dopóki Anonymous włączone).
 * Jeśli wyłączone – po prostu czekamy aż użytkownik zaloguje się Google/e-mail. */
(async function () {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(function (e) {
        console.info("[MotoRun] Anonimowe logowanie niedostępne – zaloguj się Google/e-mail.", e && e.code);
      });
    }
  } catch (e) { /* ignore */ }
  window.TFCard.ready = true;
  if (uid && auth.currentUser) startWatch();
  window.dispatchEvent(new CustomEvent("tfcard-ready", { detail: { connected: !!uid, name: name } }));
  console.info("[MotoRun] TF CARD gotowe. Połączony:", !!uid);
})();
