/* =========================================================================
 *  MotoRun – Misje dzienne (3 misje/dzień, te same dla wszystkich w danym dniu)
 *  Nagrody trafiają do TEOpoints (TF CARD gdy połączony, inaczej lokalnie).
 * ========================================================================= */
window.Missions = (function () {
  const LS = "motorun_missions_v1";

  // deterministyczny RNG z ziarna (mulberry32)
  function seedFromDate(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  const POOL = [
    { type: "distance", target: 2000, reward: 300, icon: "🛣️", desc: function (n) { return "Przejedź łącznie " + n + " m"; } },
    { type: "flips",    target: 18,   reward: 280, icon: "🤸", desc: function (n) { return "Zrób " + n + " salt"; } },
    { type: "coins",    target: 100,  reward: 220, icon: "🪙", desc: function (n) { return "Zbierz " + n + " z monet"; } },
    { type: "runs",     target: 6,    reward: 180, icon: "🏍️", desc: function (n) { return "Rozegraj " + n + " przejazdów"; } },
    { type: "score",    target: 4500, reward: 400, icon: "🎯", desc: function (n) { return "Zdobądź " + n + " pkt w jednym przejeździe"; } }
  ];

  function today() { return new Date().toISOString().slice(0, 10); }

  function generate(day) {
    const rng = seedFromDate(day);
    const idx = POOL.map(function (_, i) { return i; });
    // tasowanie deterministyczne
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, 3).map(function (i) {
      const tpl = POOL[i];
      // lekka wariacja celu w zależności od dnia (+/- 20%)
      const target = Math.round(tpl.target * (0.8 + rng() * 0.4));
      return { type: tpl.type, target: target, reward: tpl.reward, icon: tpl.icon, text: tpl.desc(target) };
    });
  }

  let state = load();

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    const day = today();
    if (!s || s.day !== day) {
      s = { day: day, missions: generate(day),
            progress: { distance: 0, flips: 0, coins: 0, runs: 0, score: 0 },
            claimed: [false, false, false] };
      save(s);
    }
    return s;
  }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

  function progressOf(m) {
    if (m.type === "score") return Math.min(state.progress.score, m.target);
    return Math.min(state.progress[m.type] || 0, m.target);
  }

  return {
    refresh: function () { state = load(); return state; },
    list: function () {
      return state.missions.map(function (m, i) {
        const p = progressOf(m);
        return { icon: m.icon, text: m.text, reward: m.reward, target: m.target,
                 progress: p, done: p >= m.target, claimed: state.claimed[i], index: i };
      });
    },
    completedCount: function () {
      return state.missions.filter(function (m, i) { return progressOf(m) >= m.target; }).length;
    },
    /* Po przejeździe: aktualizuje postęp i zwraca listę nowo ukończonych (z nagrodą). */
    applyRun: function (stats) {
      state = load();
      state.progress.distance += Math.floor(stats.distance);
      state.progress.flips    += stats.flips;
      state.progress.coins    += stats.coins;
      state.progress.runs     += 1;
      state.progress.score     = Math.max(state.progress.score, stats.score);

      const newlyDone = [];
      state.missions.forEach(function (m, i) {
        if (!state.claimed[i] && progressOf(m) >= m.target) {
          state.claimed[i] = true;
          newlyDone.push(m);
          if (window.Economy) Economy.addTeopoints(m.reward, "MotoRun: misja – " + m.text);
          if (window.Analytics) Analytics.track("mission_complete", { type: m.type, reward: m.reward });
        }
      });
      save(state);
      return newlyDone;
    }
  };
})();
