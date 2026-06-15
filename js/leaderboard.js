/* =========================================================================
 *  MotoRun – Ranking (leaderboard) na Firestore (projekt tf-card)
 *  Kolekcja: motorun_scores/<uid> = { name, score, distance, ts }
 *  Współdzieli instancję Firestore z modułem TEOpoints (window.__MOTORUN_FB).
 * ========================================================================= */
import {
  collection, doc, getDoc, setDoc, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const LS_NICK = "motorun_nick";

function db() { return window.__MOTORUN_FB && window.__MOTORUN_FB.db; }
function playerId() {
  return (window.TFCard && (window.TFCard.uid || window.TFCard.authUid)) || null;
}
function playerName() {
  if (window.TFCard && window.TFCard.name) return window.TFCard.name;
  return localStorage.getItem(LS_NICK) || "Gracz";
}

async function submit(score, distance) {
  const database = db(), id = playerId();
  if (!database || !id || !score) return { ok: false };
  try {
    const refDoc = doc(database, "motorun_scores", id);
    const prev = await getDoc(refDoc);
    const best = prev.exists() ? (prev.data().score || 0) : 0;
    if (score <= best) return { ok: true, improved: false };
    await setDoc(refDoc, {
      name: playerName(), score: Math.round(score),
      distance: Math.round(distance || 0), ts: Date.now()
    }, { merge: true });
    if (window.Analytics) Analytics.track("leaderboard_submit", { score: Math.round(score) });
    return { ok: true, improved: true };
  } catch (e) {
    console.warn("[Leaderboard] submit error:", e);
    return { ok: false, reason: String(e) };
  }
}

async function top(n) {
  const database = db();
  if (!database) return [];
  try {
    const q = query(collection(database, "motorun_scores"), orderBy("score", "desc"), limit(n || 20));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(function (d) { rows.push(d.data()); });
    return rows;
  } catch (e) {
    console.warn("[Leaderboard] top error:", e);
    return [];
  }
}

window.Leaderboard = {
  submit: submit,
  top: top,
  myId: playerId,
  getNick: function () { return playerName(); },
  setNick: function (nick) { if (nick) localStorage.setItem(LS_NICK, nick); }
};
