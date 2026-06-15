/* =========================================================================
 *  MotoRun – Koło Szczęścia (jeden darmowy spin dziennie)
 *  8 pól: TEOpoints, JACKPOT, naklejka. Nagroda -> TEOpoints / Kolekcja.
 * ========================================================================= */
window.Wheel = (function () {
  const LS = "motorun_wheel_v1";

  // kolejność pól zgodna z grafiką koła (8 segmentów po 45°)
  const SEGMENTS = [
    { kind: "teo", amount: 20,  label: "20",      color: "#3a86c8" },
    { kind: "teo", amount: 60,  label: "60",      color: "#6a994e" },
    { kind: "sticker",          label: "🏷️",      color: "#bc4749" },
    { kind: "teo", amount: 40,  label: "40",      color: "#d4a017" },
    { kind: "teo", amount: 200, label: "JACKPOT", color: "#7d4ea8" },
    { kind: "teo", amount: 30,  label: "30",      color: "#3a86c8" },
    { kind: "sticker",          label: "🏷️",      color: "#c1561f" },
    { kind: "teo", amount: 100, label: "100",     color: "#6a994e" }
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
