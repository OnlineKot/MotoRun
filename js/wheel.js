/* =========================================================================
 *  MotoRun – Koło Szczęścia (jeden darmowy spin dziennie)
 *  8 pól: TEOpoints, JACKPOT, naklejka. Nagroda -> TEOpoints / Kolekcja.
 * ========================================================================= */
window.Wheel = (function () {
  const LS = "motorun_wheel_v1";

  // kolejność pól zgodna z grafiką koła (8 segmentów po 45°)
  const SEGMENTS = [
    { kind: "teo", amount: 100,  label: "100",     color: "#00e5ff" },
    { kind: "teo", amount: 300,  label: "300",     color: "#aaff00" },
    { kind: "sticker",           label: "🏷️",      color: "#ff2d95" },
    { kind: "teo", amount: 200,  label: "200",     color: "#ffd23f" },
    { kind: "teo", amount: 1000, label: "JACKPOT", color: "#b14bff" },
    { kind: "teo", amount: 150,  label: "150",     color: "#00e5ff" },
    { kind: "sticker",           label: "🏷️",      color: "#ff5722" },
    { kind: "teo", amount: 500,  label: "500",     color: "#aaff00" }
  ];
  // wagi losowania (JACKPOT i naklejki rzadsze)
  const WEIGHTS = [22, 16, 12, 18, 4, 16, 8, 6];

  function today() { return new Date().toISOString().slice(0, 10); }
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

  let state = load();

  function pickIndex() {
    const total = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
    let r = Math.random() * total;
    for (let i = 0; i < WEIGHTS.length; i++) { if ((r -= WEIGHTS[i]) < 0) return i; }
    return 0;
  }

  return {
    SEGMENTS: SEGMENTS,
    canSpin: function () { return state.lastDay !== today(); },

    /* Zwraca { index, segment, reward, sticker } albo null gdy już dziś kręcono. */
    spin: function () {
      if (!this.canSpin()) return null;
      const i = pickIndex();
      const seg = SEGMENTS[i];
      state.lastDay = today();
      save(state);

      let reward = 0, sticker = null;
      if (seg.kind === "teo") {
        reward = seg.amount;
        if (window.Economy) Economy.addTeopoints(reward, "MotoRun: Koło Szczęścia");
      } else if (seg.kind === "sticker" && window.Collection) {
        const drop = window.Collection.rollDrop(1); // pewny drop
        sticker = drop ? drop.sticker : null;
        if (drop && drop.completed) reward = drop.reward;
      }
      if (window.Analytics) Analytics.track("wheel_spin", { index: i, kind: seg.kind, reward: reward });
      return { index: i, segment: seg, reward: reward, sticker: sticker };
    }
  };
})();
