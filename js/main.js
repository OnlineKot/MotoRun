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
  const hud = $("hud");

  function showScreen(el) {
    [screenMenu, screenShop, screenOver, screenConnect].forEach(function (s) { s.classList.add("hidden"); });
    if (el) el.classList.remove("hidden");
  }

  /* --- HUD --- */
  function updateHud(d) {
    $("hud-score").textContent = d.score;
    $("hud-dist").textContent = d.distance + " m";
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
      } else if (st === "crashed") {
        hud.classList.add("hidden");
        const s = data.stats;
        $("over-score").textContent = s.score;
        $("over-dist").textContent = Math.floor(s.distance) + " m";
        $("over-flips").textContent = s.flips;
        $("over-best-combo").textContent = "x" + (1 + s.bestCombo);
        $("over-earned").textContent = "+" + data.earned;
        $("over-reason").textContent = data.reason || "";
        showScreen(screenOver);
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

  // start na menu
  updateConnectUI();
  showScreen(screenMenu);
  hud.classList.add("hidden");
})();
