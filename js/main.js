/* =========================================================================
 *  MotoRun – spinacz UI: menu, HUD, ekran końca gry, sklep TFcard, logowanie.
 * ========================================================================= */
(function () {
  const $ = function (id) { return document.getElementById(id); };

  /* --- inicjalizacja modułów --- */
  window.Auth.init();
  window.Economy.init();

  /* --- elementy --- */
  const screenMenu = $("screen-menu");
  const screenShop = $("screen-shop");
  const screenOver = $("screen-over");
  const screenConnect = $("screen-connect");
  const screenRevive = $("screen-revive");
  const screenMissions = $("screen-missions");
  const screenWheel = $("screen-wheel");
  const screenCollection = $("screen-collection");
  const screenLeaderboard = $("screen-leaderboard");
  const screenAchievements = $("screen-achievements");
  const hud = $("hud");

  const ALL_SCREENS = [screenMenu, screenShop, screenOver, screenConnect, screenRevive,
    screenMissions, screenWheel, screenCollection, screenLeaderboard, screenAchievements];

  function showScreen(el) {
    ALL_SCREENS.forEach(function (s) { s.classList.add("hidden"); });
    if (el) el.classList.remove("hidden");
  }

  /* --- HUD --- */
  function updateHud(d) {
    $("hud-score").textContent = d.score;
    $("hud-dist").textContent = d.distance + " m · " + d.speed + " km/h";
    $("hud-combo").textContent = d.combo > 0 ? ("COMBO x" + (1 + d.combo)) : "";
    $("hud-teo").textContent = "🪙 " + d.teopoints;
  }

  /* --- pasek profilu (TEO + login). Saldo bierzemy z Economy (TF CARD gdy połączony). --- */
  function refreshProfileBar() {
    const p = window.Economy.profile;
    $("teo-balance").textContent = window.Economy.teopoints;
    $("best-score").textContent = p.highScore | 0;
    $("streak").textContent = p.streakDays | 0;
  }
  window.Economy.onChange(refreshProfileBar);

  /* --- stan logowania --- */
  window.Auth.onChange(function (user) {
    const box = $("auth-box");
    if (user && !user.isAnonymous) {
      box.innerHTML = '👤 ' + (user.displayName || user.email || "Gracz") +
        ' <button id="btn-logout" class="link">wyloguj</button>';
      $("btn-logout").onclick = function () { window.Auth.logout(); };
    } else if (user && user.isAnonymous) {
      box.innerHTML = '👤 Gość <button id="btn-google2" class="link">zaloguj Google</button>';
      $("btn-google2").onclick = function () { window.Auth.loginGoogle(); };
    } else {
      box.innerHTML = window.Auth.enabled
        ? '<button id="btn-google" class="link">Zaloguj przez Google</button> · <button id="btn-guest" class="link">Graj jako gość</button>'
        : '🔒 Tryb offline (skonfiguruj Firebase w js/config.js)';
      if ($("btn-google")) $("btn-google").onclick = function () { window.Auth.loginGoogle(); };
      if ($("btn-guest")) $("btn-guest").onclick = function () { window.Auth.loginGuest(); };
    }
  });

  /* --- SKLEP TFcard --- */
  function renderShop() {
    const grid = $("shop-grid");
    const p = window.Economy.profile;
    grid.innerHTML = "";
    window.Economy.CATALOG.forEach(function (item) {
      const owned = p.ownedSkins.indexOf(item.id) !== -1;
      const selected = p.selectedSkin === item.id;
      const card = document.createElement("div");
      card.className = "skin-card" + (selected ? " selected" : "");
      card.style.borderColor = item.color;
      card.innerHTML =
        '<div class="skin-emoji" style="text-shadow:0 0 14px ' + item.color + '">' + item.emoji + '</div>' +
        '<div class="skin-name">' + item.name + '</div>' +
        '<div class="skin-price">' + (item.price === 0 ? "DARMOWY" : "🪙 " + item.price) + '</div>' +
        '<button class="skin-btn">' +
          (selected ? "✓ Wybrany" : owned ? "Wybierz" : "Kup") +
        '</button>';
      const btn = card.querySelector(".skin-btn");
      btn.onclick = async function () {
        if (selected) return;
        if (owned) {
          window.Economy.selectSkin(item.id);
        } else {
          btn.disabled = true; btn.textContent = "…";
          const r = await window.Economy.buySkin(item.id);
          if (!r.ok) { toast(r.reason); renderShop(); return; }
          toast("Kupiono " + item.name + "! 🎉");
        }
        renderShop();
      };
      grid.appendChild(card);
    });
    $("shop-teo").textContent = window.Economy.teopoints;
  }

  /* --- toast --- */
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* --- gra --- */
  window.Game.init($("game-canvas"), {
    onHud: updateHud,
    onStateChange: function (st, data) {
      if (st === "running") {
        showScreen(null);
        hud.classList.remove("hidden");
      } else if (st === "revive") {
        hud.classList.add("hidden");
        $("revive-reason").textContent = data.reason || "";
        $("revive-cost").textContent = data.reviveCost;
        const rb = $("btn-revive");
        rb.disabled = !data.canAfford;
        rb.style.opacity = data.canAfford ? "1" : "0.45";
        showScreen(screenRevive);
      } else if (st === "gameover") {
        hud.classList.add("hidden");
        const s = data.stats;
        $("over-score").textContent = s.score;
        $("over-dist").textContent = Math.floor(s.distance) + " m";
        $("over-flips").textContent = s.flips;
        $("over-best-combo").textContent = "x" + (1 + s.bestCombo);
        $("over-earned").textContent = "+" + data.earned;
        $("over-reason").textContent = data.reason || "";
        showScreen(screenOver);
        finalizeRunUI(s);
      } else if (st === "menu") {
        hud.classList.add("hidden");
        showScreen(screenMenu);
      }
    }
  });

  /* --- przyciski --- */
  $("btn-play").onclick = function () {
    const reward = window.Economy.checkDailyStreak();
    if (reward > 0) toast("Seria " + window.Economy.profile.streakDays + " dni! +" + reward + " 🪙");
    window.Game.start();
  };
  $("btn-shop").onclick = function () { renderShop(); showScreen(screenShop); };
  $("btn-shop-back").onclick = function () { showScreen(screenMenu); };
  $("btn-again").onclick = function () { window.Game.start(); };
  $("btn-menu").onclick = function () { window.Game.setMenu(); };
  $("btn-over-shop").onclick = function () { renderShop(); showScreen(screenShop); };

  /* ====================== ŁĄCZENIE KONTA TF CARD ====================== */
  function updateConnectUI() {
    const tf = window.TFCard;
    const b = $("btn-connect");
    if (tf && tf.connected) b.innerHTML = "💳 TF CARD: " + (tf.name || "konto") + " ✓";
    else b.textContent = "💳 Połącz konto TF CARD";
    refreshProfileBar();
    if (!screenConnect.classList.contains("hidden")) renderConnectStatus();
    const over = $("btn-over-connect");
    if (over) over.classList.toggle("hidden", !!(tf && tf.connected));
  }

  function renderConnectStatus() {
    const tf = window.TFCard;
    const st = $("connect-status");
    const pin = $("connect-pin"), doBtn = $("btn-connect-do"), offBtn = $("btn-disconnect");
    if (tf && tf.connected) {
      st.innerHTML = "✅ Połączono jako <b>" + (tf.name || "Gracz") + "</b><br>Saldo: 🪙 " + tf.balance + " TEO";
      pin.classList.add("hidden"); doBtn.classList.add("hidden"); offBtn.classList.remove("hidden");
    } else if (!tf || !tf.ready) {
      st.textContent = "Łączenie z TF CARD…";
      pin.classList.remove("hidden"); doBtn.classList.remove("hidden"); offBtn.classList.add("hidden");
    } else {
      st.textContent = "Nie połączono. Wpisz PIN konta TF CARD.";
      pin.classList.remove("hidden"); doBtn.classList.remove("hidden"); offBtn.classList.add("hidden");
    }
  }

  function openConnect() { renderConnectStatus(); showScreen(screenConnect); }

  $("btn-connect").onclick = openConnect;
  $("btn-connect-back").onclick = function () { showScreen(screenMenu); };
  $("btn-over-connect").onclick = openConnect;
  $("btn-disconnect").onclick = function () {
    window.TFCard.disconnect(); renderConnectStatus(); toast("Odłączono konto TF CARD.");
  };
  $("btn-connect-do").onclick = async function () {
    const pinEl = $("connect-pin");
    const pin = (pinEl.value || "").trim();
    if (!pin) { toast("Wpisz PIN."); return; }
    if (!window.TFCard || !window.TFCard.ready) { toast("TF CARD jeszcze się łączy…"); return; }
    const btn = $("btn-connect-do");
    btn.disabled = true; btn.textContent = "…";
    const r = await window.TFCard.connect(pin);
    btn.disabled = false; btn.textContent = "Połącz";
    if (!r.ok) { toast(r.reason || "Błąd połączenia."); return; }
    pinEl.value = "";
    toast("Połączono: " + r.name + " 🎉");
    renderConnectStatus();
  };

  // zdarzenia z modułu TF CARD (na żywo)
  window.addEventListener("tfcard-ready",      updateConnectUI);
  window.addEventListener("tfcard-connect",    updateConnectUI);
  window.addEventListener("tfcard-disconnect", updateConnectUI);
  window.addEventListener("tfcard-teo", function () {
    refreshProfileBar();
    if (!screenShop.classList.contains("hidden")) $("shop-teo").textContent = window.Economy.teopoints;
    if (!screenConnect.classList.contains("hidden")) renderConnectStatus();
  });

  /* ====================== REVIVE ====================== */
  $("btn-revive").onclick = async function () {
    const cost = window.Game.reviveCost();
    const btn = $("btn-revive");
    btn.disabled = true;
    const r = await window.Economy.spend(cost, "MotoRun: wskrzeszenie");
    btn.disabled = false;
    if (!r.ok) { toast(r.reason || "Za mało TEOpoints."); return; }
    window.Game.revive();
  };
  $("btn-revive-no").onclick = function () { window.Game.gameOver(); };

  /* ====================== POWIADOMIENIA PO PRZEJEŹDZIE ====================== */
  function queueToasts(arr) {
    arr.forEach(function (msg, i) { setTimeout(function () { toast(msg); }, i * 1700); });
  }
  function finalizeRunUI(stats) {
    const notes = [];
    if (window.Missions) {
      Missions.applyRun(stats).forEach(function (m) {
        notes.push("🎯 Misja ukończona! +" + m.reward + " 🪙");
      });
    }
    if (window.Achievements) {
      Achievements.check({ stats: stats, profile: window.Economy.profile, totalRuns: window.Economy.profile.totalRuns })
        .forEach(function (a) { notes.push("🏅 " + a.name + "! +" + a.reward + " 🪙"); });
    }
    if (window.Collection) {
      const drop = Collection.rollDrop(0.45);
      if (drop && drop.isNew) notes.push("🏷️ Nowa naklejka: " + drop.sticker.emoji + " " + drop.sticker.name);
      if (drop && drop.completed) notes.push("🎉 KOMPLET naklejek! +" + drop.reward + " 🪙");
    }
    if (window.Leaderboard) window.Leaderboard.submit(stats.score, stats.distance);
    refreshProfileBar();
    refreshBadges();
    queueToasts(notes);
  }

  /* ====================== BADGE w menu ====================== */
  function refreshBadges() {
    const mb = $("badge-missions");
    if (window.Missions && mb) {
      const list = Missions.list();
      const remaining = list.filter(function (m) { return !m.claimed; }).length;
      if (remaining > 0) { mb.textContent = remaining; mb.classList.remove("hidden"); }
      else mb.classList.add("hidden");
    }
    const wb = $("badge-wheel");
    if (window.Wheel && wb) wb.classList.toggle("hidden", !Wheel.canSpin());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ====================== MISJE ====================== */
  function renderMissions() {
    if (!window.Missions) return;
    Missions.refresh();
    const wrap = $("missions-list"); wrap.innerHTML = "";
    Missions.list().forEach(function (m) {
      const pct = Math.min(100, Math.round(m.progress / m.target * 100));
      const row = document.createElement("div");
      row.className = "list-row" + (m.claimed ? " done" : "");
      row.innerHTML =
        '<div class="lr-icon">' + m.icon + '</div>' +
        '<div class="lr-main"><div class="lr-title">' + m.text + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="lr-sub">' + Math.min(m.progress, m.target) + ' / ' + m.target + '</div></div>' +
        '<div class="lr-reward">' + (m.claimed ? "✅" : "🪙 " + m.reward) + '</div>';
      wrap.appendChild(row);
    });
  }

  /* ====================== KOLEKCJA ====================== */
  function renderCollection() {
    if (!window.Collection) return;
    $("collection-sub").textContent = "Masz " + Collection.ownedCount() + "/" + Collection.total() +
      " • ukończone komplety: " + Collection.seasons();
    const grid = $("collection-grid"); grid.innerHTML = "";
    Collection.list().forEach(function (s) {
      const c = document.createElement("div");
      c.className = "coll-item" + (s.owned ? " owned" : "");
      c.innerHTML = '<div class="coll-emoji">' + (s.owned ? s.emoji : "❓") + '</div>' +
        '<div class="coll-name">' + s.name + '</div>';
      grid.appendChild(c);
    });
  }

  /* ====================== OSIĄGNIĘCIA ====================== */
  function renderAchievements() {
    if (!window.Achievements) return;
    $("achievements-sub").textContent = Achievements.unlockedCount() + "/" + Achievements.total() + " odblokowane";
    const grid = $("achievements-grid"); grid.innerHTML = "";
    Achievements.list().forEach(function (a) {
      const c = document.createElement("div");
      c.className = "coll-item" + (a.unlocked ? " owned" : "");
      c.innerHTML = '<div class="coll-emoji">' + (a.unlocked ? a.icon : "🔒") + '</div>' +
        '<div class="coll-name">' + a.name + '</div>' +
        '<div class="coll-rew">🪙 ' + a.reward + '</div>';
      grid.appendChild(c);
    });
  }

  /* ====================== KOŁO SZCZĘŚCIA ====================== */
  function buildWheel() {
    if (!window.Wheel) return;
    const el = $("wheel"), segs = Wheel.SEGMENTS, step = 360 / segs.length;
    const stops = segs.map(function (s, i) { return s.color + " " + (i * step) + "deg " + ((i + 1) * step) + "deg"; });
    el.style.background = "conic-gradient(" + stops.join(",") + ")";
    el.innerHTML = "";
    segs.forEach(function (s, i) {
      const lab = document.createElement("div");
      lab.className = "wheel-label";
      lab.textContent = s.label;
      const ang = i * step + step / 2;
      lab.style.transform = "rotate(" + ang + "deg) translateY(-78px) rotate(" + (-ang) + "deg)";
      el.appendChild(lab);
    });
    el.style.transition = "none";
    el.style.transform = "rotate(0deg)";
    void el.offsetWidth; // reflow
  }
  function updateSpinBtn() {
    const b = $("btn-spin");
    if (window.Wheel && Wheel.canSpin()) { b.disabled = false; b.textContent = "🎰 Zakręć"; }
    else { b.disabled = true; b.textContent = "✅ Wróć jutro"; }
  }
  function doSpin() {
    if (!window.Wheel || !Wheel.canSpin()) { toast("Dziś już kręciłeś. Wróć jutro!"); return; }
    const res = Wheel.spin();
    if (!res) return;
    const step = 360 / Wheel.SEGMENTS.length;
    const center = res.index * step + step / 2;
    const el = $("wheel");
    el.style.transition = "transform 4s cubic-bezier(.16,.84,.34,1.06)";
    el.style.transform = "rotate(" + (360 * 5 - center) + "deg)";
    $("btn-spin").disabled = true;
    $("wheel-result").textContent = "";
    setTimeout(function () {
      let msg = res.segment.kind === "teo"
        ? "Wygrałeś 🪙 " + res.reward + "!"
        : (res.sticker ? "Naklejka " + res.sticker.emoji + " " + res.sticker.name + "!" : "Nagroda!");
      if (res.reward && res.segment.kind !== "teo") msg += " (+komplet 🪙 " + res.reward + ")";
      $("wheel-result").textContent = msg;
      refreshProfileBar(); refreshBadges(); updateSpinBtn();
    }, 4200);
  }
  function openWheel() { buildWheel(); $("wheel-result").textContent = ""; updateSpinBtn(); showScreen(screenWheel); }

  /* ====================== RANKING ====================== */
  function renderLeaderboard() {
    const list = $("leaderboard-list");
    list.textContent = "Ładowanie…";
    if (window.Leaderboard) $("nick-input").value = window.Leaderboard.getNick();
    if (!window.Leaderboard) { list.textContent = "Ranking niedostępny."; return; }
    window.Leaderboard.top(20).then(function (rows) {
      if (!rows.length) { list.innerHTML = '<div class="lr-empty">Brak wyników. Bądź pierwszy! 🏁</div>'; return; }
      list.innerHTML = "";
      rows.forEach(function (r, i) {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
        const row = document.createElement("div");
        row.className = "list-row rank";
        row.innerHTML =
          '<div class="rank-pos">' + medal + '</div>' +
          '<div class="lr-main"><div class="lr-title">' + escapeHtml(r.name || "Gracz") + '</div>' +
          '<div class="lr-sub">' + (r.distance || 0) + ' m</div></div>' +
          '<div class="lr-reward">' + (r.score || 0) + '</div>';
        list.appendChild(row);
      });
    });
  }

  /* ====================== przyciski funkcji ====================== */
  $("btn-missions").onclick     = function () { renderMissions(); showScreen(screenMissions); };
  $("btn-wheel").onclick        = openWheel;
  $("btn-collection").onclick   = function () { renderCollection(); showScreen(screenCollection); };
  $("btn-leaderboard").onclick  = function () { renderLeaderboard(); showScreen(screenLeaderboard); };
  $("btn-achievements").onclick = function () { renderAchievements(); showScreen(screenAchievements); };
  $("btn-spin").onclick         = doSpin;
  $("btn-nick-save").onclick = function () {
    const v = $("nick-input").value.trim();
    if (v && window.Leaderboard) { window.Leaderboard.setNick(v); toast("Zapisano nick: " + v); }
  };
  Array.prototype.forEach.call(document.querySelectorAll("[data-back]"), function (b) {
    b.onclick = function () { showScreen(screenMenu); };
  });

  // wyciszanie dźwięku
  $("btn-mute").onclick = function () {
    const m = window.Game.toggleMute();
    $("btn-mute").textContent = m ? "🔇" : "🔊";
  };

  // start na menu
  updateConnectUI();
  refreshBadges();
  showScreen(screenMenu);
  hud.classList.add("hidden");
})();
