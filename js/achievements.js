/* =========================================================================
 *  MotoRun – Osiągnięcia (jednorazowe nagrody za kamienie milowe)
 * ========================================================================= */
window.Achievements = (function () {
  const LS = "motorun_ach_v1";

  // ctx = { stats, profile, totalRuns }
  const DEFS = [
    { id: "first_flip", icon: "🤸", name: "Pierwsze salto", reward: 100, test: function (c) { return c.stats.flips >= 1; } },
    { id: "combo5",     icon: "🔥", name: "Combo x5",        reward: 200, test: function (c) { return c.stats.bestCombo >= 5; } },
    { id: "dist1000",   icon: "🛣️", name: "1000 metrów",     reward: 250, test: function (c) { return c.stats.distance >= 1000; } },
    { id: "dist3000",   icon: "🚀", name: "3000 metrów",     reward: 500, test: function (c) { return c.stats.distance >= 3000; } },
    { id: "score5000",  icon: "🎯", name: "5000 punktów",    reward: 400, test: function (c) { return c.stats.score >= 5000; } },
    { id: "runs10",     icon: "🏍️", name: "10 przejazdów",   reward: 200, test: function (c) { return c.totalRuns >= 10; } },
    { id: "runs50",     icon: "🏅", name: "50 przejazdów",   reward: 600, test: function (c) { return c.totalRuns >= 50; } },
    { id: "perfect3",   icon: "✨", name: "3x Perfect w jeździe", reward: 300, test: function (c) { return c.stats.perfectLandings >= 3; } }
  ];

  let unlocked = load();
  function load() {
    try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(unlocked)); } catch (e) {} }

  return {
    list: function () {
      return DEFS.map(function (d) {
        return { icon: d.icon, name: d.name, reward: d.reward, unlocked: unlocked.indexOf(d.id) !== -1 };
      });
    },
    unlockedCount: function () { return unlocked.length; },
    total: function () { return DEFS.length; },

    /* Sprawdza po przejeździe; zwraca listę nowo odblokowanych. */
    check: function (ctx) {
      const newly = [];
      DEFS.forEach(function (d) {
        if (unlocked.indexOf(d.id) === -1 && d.test(ctx)) {
          unlocked.push(d.id);
          newly.push(d);
          if (window.Economy) Economy.addTeopoints(d.reward, "MotoRun: osiągnięcie – " + d.name);
          if (window.Analytics) Analytics.track("achievement", { id: d.id, reward: d.reward });
        }
      });
      if (newly.length) save();
      return newly;
    }
  };
})();
