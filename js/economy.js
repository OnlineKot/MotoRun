/* =========================================================================
 *  MotoRun – Ekonomia: TEOpoints + sklep TFcard
 *  Zakupy BEZ karty i BEZ weryfikacji (requireCardVerification: false).
 *  Płacisz wyłącznie wirtualnymi TEOpointsami.
 *  Trwałość: localStorage + (jeśli zalogowany) Firestore.
 * ========================================================================= */

window.Economy = (function () {
  const CFG = window.MOTORUN_CONFIG;
  const LS_KEY = "motorun_profile_v1";

  /* Katalog skinów motocykla dostępnych w TFcard.
   * cena w TEOpoints; pierwszy jest darmowy i domyślny. */
  const CATALOG = [
    { id: "neon",    name: "Neon Classic",  price: 0,    color: "#00e5ff", trail: "#00e5ff", emoji: "🏍️" },
    { id: "lime",    name: "Toxic Lime",    price: 300,  color: "#aaff00", trail: "#aaff00", emoji: "🟢" },
    { id: "magenta", name: "Magenta Rush",  price: 600,  color: "#ff2d95", trail: "#ff2d95", emoji: "🛵" },
    { id: "gold",    name: "Gold Streak",   price: 1200, color: "#ffd23f", trail: "#ffd23f", emoji: "🥇" },
    { id: "ice",     name: "Ice Phantom",   price: 2000, color: "#a0d8ff", trail: "#ffffff", emoji: "❄️" },
    { id: "inferno", name: "Inferno X",     price: 3500, color: "#ff5722", trail: "#ffcc00", emoji: "🔥" },
    { id: "void",    name: "Void Hunter",   price: 6000, color: "#b14bff", trail: "#7a00ff", emoji: "🟣" }
  ];

  const defaultProfile = {
    teopoints: CFG.ECONOMY.startingTeopoints,
    highScore: 200,   // rekord bazowy – od niego trzeba się odbić, by zdobyć TEO
    bestDistance: 0,
    ownedSkins: ["neon"],
    selectedSkin: "neon",
    streakDays: 0,
    lastPlayDay: null,
    totalRuns: 0
  };

  let profile = Object.assign({}, defaultProfile);
  const listeners = [];
  function emit() { listeners.forEach(function (fn) { fn(profile); }); }

  /* Czy gracz ma połączone konto TF CARD (źródło prawdy dla TEOpoints). */
  function tf() { return (window.TFCard && window.TFCard.connected) ? window.TFCard : null; }

  /* Dopisanie TEO: jeśli połączony TF CARD -> do TF CARD; inaczej lokalnie. */
  function creditTeo(amount, title) {
    if (amount <= 0) return;
    const t = tf();
    if (t) { t.earn(amount, title); }
    else { profile.teopoints += amount; }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) profile = Object.assign({}, defaultProfile, JSON.parse(raw));
    } catch (e) {}
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(profile)); } catch (e) {}
    if (window.Auth && window.Auth.user) window.Auth.saveProfile(profile);
    emit();
  }

  /* Łączymy profil lokalny z chmurowym (bierzemy korzystniejsze wartości). */
  function mergeCloud(cloud) {
    if (!cloud) return;
    profile.teopoints   = Math.max(profile.teopoints, cloud.teopoints || 0);
    profile.highScore   = Math.max(profile.highScore, cloud.highScore || 0);
    profile.bestDistance = Math.max(profile.bestDistance, cloud.bestDistance || 0);
    profile.totalRuns   = Math.max(profile.totalRuns, cloud.totalRuns || 0);
    profile.streakDays  = Math.max(profile.streakDays, cloud.streakDays || 0);
    const owned = new Set((cloud.ownedSkins || []).concat(profile.ownedSkins));
    profile.ownedSkins  = Array.from(owned);
    if (cloud.selectedSkin) profile.selectedSkin = cloud.selectedSkin;
    persist();
  }

  /* Dzienny streak – nagroda za codzienne granie (mechanika uzależniająca). */
  function checkDailyStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (profile.lastPlayDay === today) return 0;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (profile.lastPlayDay === yesterday) profile.streakDays += 1;
    else profile.streakDays = 1;
    profile.lastPlayDay = today;
    const reward = profile.streakDays * 10;
    creditTeo(reward, "MotoRun: seria " + profile.streakDays + " dni");
    persist();
    window.Analytics.track("daily_streak", { day: profile.streakDays, reward: reward });
    return reward;
  }

  return {
    CATALOG: CATALOG,
    init: function () {
      loadLocal();
      emit();
      // Po zalogowaniu dociągnij profil z chmury i scal.
      if (window.Auth) {
        window.Auth.onChange(function (user) {
          if (user) window.Auth.loadProfile().then(mergeCloud);
        });
      }
    },
    onChange: function (fn) { listeners.push(fn); fn(profile); },
    get profile() { return profile; },
    /* Saldo: z TF CARD (na żywo) gdy połączony, inaczej lokalne. */
    get teopoints() {
      const t = tf();
      return t ? Math.floor(t.balance) : Math.floor(profile.teopoints);
    },
    get isTFCardConnected() { return !!tf(); },

    addTeopoints: function (amount, title) {
      creditTeo(amount, title || "MotoRun");
      persist();
    },

    /* Wydanie TEO (np. Revive). TF CARD gdy połączony, inaczej lokalnie. */
    spend: async function (amount, title) {
      amount = Math.round(amount);
      const t = tf();
      if (t) { return await t.spend(amount, title || "MotoRun: koszt"); }
      if (profile.teopoints < amount) return { ok: false, reason: "Za mało TEOpoints." };
      profile.teopoints -= amount;
      persist();
      return { ok: true };
    },

    /* Zakup skinu w TFcard – bez karty, tylko TEOpoints.
     * Async: gdy połączony TF CARD, koszt jest pobierany z konta na serwerze. */
    buySkin: async function (skinId) {
      const item = CATALOG.find(function (s) { return s.id === skinId; });
      if (!item) return { ok: false, reason: "Nie ma takiego skinu." };
      if (profile.ownedSkins.indexOf(skinId) !== -1) return { ok: false, reason: "Już posiadasz." };

      const t = tf();
      if (item.price > 0) {
        if (t) {
          const res = await t.spend(item.price, "MotoRun: skórka " + item.name);
          if (!res.ok) return { ok: false, reason: res.reason };
        } else {
          if (profile.teopoints < item.price) return { ok: false, reason: "Za mało TEOpoints." };
          profile.teopoints -= item.price;
        }
      }

      profile.ownedSkins.push(skinId);
      profile.selectedSkin = skinId;
      persist();
      window.Analytics.track("purchase", {
        item_id: skinId, item_name: item.name, price_teopoints: item.price,
        currency: "TEO", card_verified: false, tfcard: !!t
      });
      return { ok: true, item: item };
    },

    selectSkin: function (skinId) {
      if (profile.ownedSkins.indexOf(skinId) === -1) return false;
      profile.selectedSkin = skinId;
      persist();
      window.Analytics.track("select_skin", { item_id: skinId });
      return true;
    },

    getSelectedSkin: function () {
      return CATALOG.find(function (s) { return s.id === profile.selectedSkin; }) || CATALOG[0];
    },

    /* Wywoływane na koniec przejazdu.
     * TEOpoints zdobywasz WYŁĄCZNIE za pobicie rekordu:
     * 1 TEO za każde 10 punktów ponad dotychczasowy rekord (bazowo 200).
     * Mnożnik combo podbija wynik w grze, więc łatwiej o rekord. */
    finishRun: function (stats) {
      const RECORD_BASE = 200;
      const oldRecord = Math.max(profile.highScore, RECORD_BASE);
      const beat = Math.max(0, stats.score - oldRecord);
      const cap = CFG.ECONOMY.maxRewardPerRun || 400;
      const earned = Math.min(Math.floor(beat / 10), cap); // 1 TEO / 10 pkt ponad rekord

      profile.totalRuns  += 1;
      profile.highScore   = Math.max(oldRecord, stats.score);
      profile.bestDistance = Math.max(profile.bestDistance, Math.floor(stats.distance));
      if (earned > 0) creditTeo(earned, "MotoRun: rekord " + stats.score + " pkt (+" + earned + ")");
      persist();

      window.Analytics.track("game_over", {
        score: stats.score, distance: Math.floor(stats.distance),
        flips: stats.flips, teopoints_earned: earned, record: profile.highScore,
        total_runs: profile.totalRuns, tfcard: !!tf()
      });
      return { earned: earned, breakdown: { record: oldRecord, beat: beat, newRecord: stats.score > oldRecord } };
    },

    checkDailyStreak: checkDailyStreak
  };
})();
