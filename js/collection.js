/* =========================================================================
 *  MotoRun – Kolekcja naklejek (jak zbieranie w appkach lojalnościowych)
 *  Losowy drop po przejeździe / z Koła. Komplet = duża nagroda + nowy sezon.
 * ========================================================================= */
window.Collection = (function () {
  const LS = "motorun_collection_v1";

  const STICKERS = [
    { id: "helm",  emoji: "🪖", name: "Kask" },
    { id: "wheel", emoji: "🛞", name: "Opona" },
    { id: "fire",  emoji: "🔥", name: "Płomień" },
    { id: "bolt",  emoji: "⚡", name: "Piorun" },
    { id: "star",  emoji: "⭐", name: "Gwiazda" },
    { id: "trophy",emoji: "🏆", name: "Puchar" },
    { id: "skull", emoji: "💀", name: "Czacha" },
    { id: "rocket",emoji: "🚀", name: "Rakieta" }
  ];
  const SET_REWARD = 1500;

  let state = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    if (!s) s = { owned: [], seasons: 0 };
    return s;
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  function grant(id) {
    if (state.owned.indexOf(id) === -1) {
      state.owned.push(id);
      save();
      return true; // nowa
    }
    return false; // duplikat
  }

  return {
    ALL: STICKERS,
    list: function () {
      return STICKERS.map(function (s) {
        return { emoji: s.emoji, name: s.name, owned: state.owned.indexOf(s.id) !== -1 };
      });
    },
    ownedCount: function () { return state.owned.length; },
    total: function () { return STICKERS.length; },
    seasons: function () { return state.seasons; },

    /* Losowy drop naklejki. Zwraca {sticker, isNew, completed} albo null. */
    rollDrop: function (chance) {
      if (Math.random() > (chance == null ? 0.5 : chance)) return null;
      const pick = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      const isNew = grant(pick.id);
      let completed = false;
      if (state.owned.length >= STICKERS.length) {
        completed = true;
        state.seasons += 1;
        state.owned = [];
        save();
        if (window.Economy) Economy.addTeopoints(SET_REWARD, "MotoRun: komplet naklejek!");
        if (window.Analytics) Analytics.track("collection_complete", { season: state.seasons, reward: SET_REWARD });
      }
      if (window.Analytics && isNew) Analytics.track("sticker_drop", { id: pick.id });
      return { sticker: pick, isNew: isNew, completed: completed, reward: completed ? SET_REWARD : 0 };
    }
  };
})();
