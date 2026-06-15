/* =========================================================================
 *  MotoRun – silnik gry (HTML5 Canvas)
 *  Oryginalna implementacja mechaniki w stylu "endless moto stunt":
 *  trzymasz -> w powietrzu motocykl robi salto; ląduj prosto albo crash.
 *  Combo, perfekcyjne lądowania, monety (TEOpoints), neonowa grafika.
 * ========================================================================= */

window.Game = (function () {
  "use strict";

  let canvas, ctx, W, H, DPR;
  let raf = null;
  let state = "menu"; // menu | running | crashed
  let onStateChange = function () {};
  let onHud = function () {};

  /* --- świat / kamera --- */
  const GROUND_BASE = 0.72;      // bazowa wysokość terenu (ułamek H)
  const SPEED = 360;             // stała prędkość pozioma (px/s w świecie)
  const GRAVITY = 2100;
  const FLIP_SPEED = 5.2;        // prędkość obrotu przy trzymaniu (rad/s)
  let camX = 0;

  /* --- gracz (motocykl) --- */
  let bike;
  function resetBike() {
    bike = {
      x: 140, y: 0, vy: 0,
      angle: 0,           // kąt nadwozia (rad)
      onGround: true,
      airRotation: 0,     // suma obrotu w locie (do liczenia salt)
      wheelSpin: 0,
      pressing: false
    };
  }

  /* --- teren proceduralny ---
   * Lista "segmentów". Każdy segment to kawałek ziemi [xStart,xEnd] z
   * funkcją wysokości, albo PRZERWA (gap), nad którą się skacze. */
  let segments = [];
  let worldEnd = 0;
  let rng = Math.random;

  function hillHeight(x, seg) {
    // gładkie pagórki = suma sinusów względem początku segmentu
    const t = x - seg.x0;
    return seg.baseY
      + Math.sin(t * 0.012 + seg.phase) * seg.amp
      + Math.sin(t * 0.027 + seg.phase * 1.7) * (seg.amp * 0.35);
  }

  function pushGround(len, amp) {
    const last = segments[segments.length - 1];
    const x0 = last ? last.x1 : 0;
    const baseY = last ? groundYAtRaw(x0) : H * GROUND_BASE;
    segments.push({ type: "ground", x0: x0, x1: x0 + len, baseY: baseY, amp: amp, phase: rng() * 6.28 });
    worldEnd = x0 + len;
  }
  function pushGap(width) {
    const last = segments[segments.length - 1];
    const x0 = last ? last.x1 : 0;
    segments.push({ type: "gap", x0: x0, x1: x0 + width, edgeY: groundYAtRaw(x0) });
    worldEnd = x0 + width;
  }

  function groundYAtRaw(x) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (x >= s.x0 && x <= s.x1) {
        if (s.type === "gap") return null;
        return hillHeight(x, s);
      }
    }
    return null;
  }

  function ensureWorld() {
    // generuj świat z wyprzedzeniem przed kamerą
    while (worldEnd < camX + W * 2.5) {
      const difficulty = Math.min(1, camX / 12000);
      const groundLen = 420 + rng() * 520;
      const amp = 14 + rng() * (26 + difficulty * 30);
      pushGround(groundLen, amp);
      // przerwa pojawia się coraz częściej i jest szersza wraz z trudnością
      if (rng() < 0.45 + difficulty * 0.25) {
        const gap = 120 + rng() * (90 + difficulty * 230);
        pushGap(gap);
      }
    }
    // sprzątaj segmenty daleko za kamerą
    while (segments.length > 3 && segments[1].x1 < camX - W) segments.shift();
  }

  /* --- monety (TEOpoints) i cząsteczki --- */
  let coins = [];
  let particles = [];
  let lastCoinX = 0;
  function spawnCoins() {
    while (lastCoinX < camX + W * 2.2) {
      lastCoinX += 200 + rng() * 260;
      const gy = groundYAtRaw(lastCoinX);
      if (gy !== null) coins.push({ x: lastCoinX, y: gy - 70 - rng() * 90, got: false });
    }
    coins = coins.filter(function (c) { return c.x > camX - 200 && !c.got; });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, sp = 60 + rng() * 220;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 1, color: color });
    }
  }

  /* --- statystyki rundy --- */
  let stats;
  function resetStats() {
    stats = { distance: 0, score: 0, flips: 0, perfectLandings: 0, coins: 0,
      combo: 0, bestCombo: 0, multiplier: 1 };
  }

  /* ============================ STEROWANIE ============================ */
  function press() {
    if (state === "menu") return;
    if (state === "crashed") return;
    bike.pressing = true;
  }
  function release() { if (bike) bike.pressing = false; }

  /* ============================ PĘTLA GRY ============================ */
  let lastT = 0;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;
    if (state === "running") update(dt);
    render();
  }

  function update(dt) {
    // ruch poziomy świata (stała prędkość)
    bike.x += SPEED * dt;
    stats.distance += SPEED * dt / 32; // ~metry
    camX = bike.x - 140;
    bike.wheelSpin += SPEED * dt * 0.02;

    ensureWorld();
    spawnCoins();

    const gy = groundYAtRaw(bike.x);

    if (bike.onGround) {
      if (gy === null) {
        // wjechaliśmy w przepaść -> lot, wyrzut zgodny z nachyleniem terenu
        bike.onGround = false;
        const slope = groundSlope(bike.x - 4);
        bike.vy = SPEED * slope; // tangens nachylenia * prędkość
        bike.airRotation = 0;
        bike.angle = Math.atan(slope);
      } else {
        bike.y = gy;
        bike.angle = Math.atan(groundSlope(bike.x));
        bike.vy = 0;
        if (bike.pressing) {
          // trzymanie na ziemi = lekki "wheelie" wizualnie
          bike.angle -= 0.18;
        }
      }
    } else {
      // w powietrzu
      bike.vy += GRAVITY * dt;
      bike.y += bike.vy * dt;
      if (bike.pressing) {
        const d = -FLIP_SPEED * dt;   // backflip
        bike.angle += d;
        bike.airRotation += d;
      }
      // lądowanie
      const landY = groundYAtRaw(bike.x);
      if (landY !== null && bike.y >= landY) {
        bike.y = landY;
        landAttempt(landY);
      } else if (bike.y > H + 200) {
        crash("Spadłeś w przepaść!");
      }
    }

    // monety
    coins.forEach(function (c) {
      if (!c.got && Math.abs(c.x - bike.x) < 34 && Math.abs(c.y - bike.y) < 46) {
        c.got = true; stats.coins += 5;
        burst(c.x, c.y, "#ffd23f", 10);
        window.Analytics && Analytics.track("coin_pickup", {});
      }
    });

    // cząsteczki
    particles.forEach(function (p) {
      p.vy += GRAVITY * 0.4 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.6;
    });
    particles = particles.filter(function (p) { return p.life > 0; });

    // wynik = dystans * mnożnik combo
    stats.score = Math.floor(stats.distance * 10 + stats.flips * 100 + stats.coins * 4);
    pushHud();
  }

  function groundSlope(x) {
    const a = groundYAtRaw(x - 3), b = groundYAtRaw(x + 3);
    if (a === null || b === null) return 0;
    return (b - a) / 6;
  }

  function landAttempt(landY) {
    const groundAngle = Math.atan(groundSlope(bike.x));
    // znormalizuj kąt nadwozia do [-PI, PI] względem nachylenia terenu
    let diff = bike.angle - groundAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const tol = 0.55; // ~31 stopni tolerancji
    if (Math.abs(diff) > tol) {
      crash("Zła pozycja przy lądowaniu!");
      return;
    }
    // udane lądowanie
    const flipsDone = Math.round(Math.abs(bike.airRotation) / (Math.PI * 2));
    bike.onGround = true;
    bike.vy = 0;
    bike.angle = groundAngle;
    bike.airRotation = 0;

    if (flipsDone > 0) {
      stats.flips += flipsDone;
      stats.combo += flipsDone;
      stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
      stats.multiplier = 1 + stats.combo * 0.25;
      burst(bike.x, bike.y, "#00e5ff", 16);
      window.Analytics && Analytics.track("flip", { count: flipsDone, combo: stats.combo });
      flashMsg(flipsDone + "x SALTO!  combo " + stats.combo);
    }
    if (Math.abs(diff) < 0.16) { // idealne lądowanie
      stats.perfectLandings += 1;
      burst(bike.x, bike.y, "#aaff00", 12);
      flashMsg("PERFECT!");
    }
  }

  let msgText = "", msgTime = 0;
  function flashMsg(txt) { msgText = txt; msgTime = 1.1; }

  function crash(reason) {
    if (state !== "running") return;
    state = "crashed";
    burst(bike.x, bike.y, "#ff2d95", 30);
    window.Analytics && Analytics.track("crash", { reason: reason, distance: Math.floor(stats.distance) });
    const result = window.Economy ? Economy.finishRun(stats) : { earned: 0 };
    onStateChange("crashed", { stats: stats, reason: reason, earned: result.earned, breakdown: result.breakdown });
  }

  /* ============================ RENDER ============================ */
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawGround();
    drawCoins();
    drawParticles();
    if (bike) drawBike();
    drawFloatingMsg();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0a23");
    g.addColorStop(0.6, "#160d33");
    g.addColorStop(1, "#070712");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // gwiazdy / siatka paralaksy
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#2a2a55";
    for (let i = 0; i < 60; i++) {
      const x = ((i * 211 - camX * 0.2) % W + W) % W;
      const y = (i * 97) % (H * 0.6);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
    // dalekie góry
    ctx.fillStyle = "#1a1240";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) {
      const wx = x + camX * 0.3;
      ctx.lineTo(x, H * 0.55 + Math.sin(wx * 0.004) * 40 + Math.sin(wx * 0.011) * 18);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawGround() {
    const skin = window.Economy ? Economy.getSelectedSkin() : { color: "#00e5ff" };
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 14;
    segments.forEach(function (s) {
      if (s.type === "gap") return;
      ctx.beginPath();
      let first = true;
      for (let wx = s.x0; wx <= s.x1; wx += 8) {
        const sx = wx - camX;
        if (sx < -20 || sx > W + 20) { first = true; continue; }
        const y = hillHeight(wx, s);
        if (first) { ctx.moveTo(sx, y); first = false; }
        else ctx.lineTo(sx, y);
      }
      ctx.stroke();
      // wypełnienie pod linią
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(s.x0 - camX, H);
      for (let wx = s.x0; wx <= s.x1; wx += 8) {
        ctx.lineTo(wx - camX, hillHeight(wx, s));
      }
      ctx.lineTo(s.x1 - camX, H);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,120,150,0.12)";
      ctx.fill();
      ctx.shadowBlur = 14;
    });
    ctx.shadowBlur = 0;
  }

  function drawCoins() {
    ctx.save();
    coins.forEach(function (c) {
      if (c.got) return;
      const sx = c.x - camX;
      if (sx < -30 || sx > W + 30) return;
      const pulse = 1 + Math.sin(performance.now() / 200 + c.x) * 0.12;
      ctx.beginPath();
      ctx.arc(sx, c.y, 11 * pulse, 0, 6.28);
      ctx.fillStyle = "#ffd23f";
      ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#7a5b00";
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("T", sx, c.y + 1);
    });
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawBike() {
    const skin = window.Economy ? Economy.getSelectedSkin() : { color: "#00e5ff", trail: "#00e5ff" };
    const sx = bike.x - camX, sy = bike.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(bike.angle);

    // smuga
    ctx.strokeStyle = skin.trail; ctx.globalAlpha = 0.25;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-60, 6); ctx.lineTo(-14, 6); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.shadowColor = skin.color; ctx.shadowBlur = 18;
    // koła
    ctx.strokeStyle = skin.color; ctx.lineWidth = 3; ctx.fillStyle = "#101020";
    [-14, 16].forEach(function (wx) {
      ctx.beginPath(); ctx.arc(wx, 6, 11, 0, 6.28); ctx.fill(); ctx.stroke();
      // szprychy
      ctx.save(); ctx.translate(wx, 6); ctx.rotate(bike.wheelSpin);
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      ctx.restore();
    });
    // rama
    ctx.beginPath();
    ctx.moveTo(-14, 6); ctx.lineTo(-2, -8); ctx.lineTo(14, -10); ctx.lineTo(16, 6);
    ctx.strokeStyle = skin.color; ctx.lineWidth = 3; ctx.stroke();
    // kierowca
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(2, -20); ctx.lineTo(14, -12);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(2, -24, 4, 0, 6.28); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawFloatingMsg() {
    if (msgTime > 0) {
      msgTime -= 0.016;
      ctx.save();
      ctx.globalAlpha = Math.min(1, msgTime * 2);
      ctx.fillStyle = "#aaff00";
      ctx.font = "bold 34px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#aaff00"; ctx.shadowBlur = 20;
      ctx.fillText(msgText, W / 2, H * 0.28);
      ctx.restore();
    }
  }

  function pushHud() {
    onHud({
      score: stats.score,
      distance: Math.floor(stats.distance),
      flips: stats.flips,
      combo: stats.combo,
      teopoints: window.Economy ? Economy.teopoints : 0
    });
  }

  /* ============================ PUBLIC API ============================ */
  function fit() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  return {
    init: function (canvasEl, opts) {
      canvas = canvasEl; ctx = canvas.getContext("2d");
      onStateChange = (opts && opts.onStateChange) || function () {};
      onHud = (opts && opts.onHud) || function () {};
      fit();
      window.addEventListener("resize", fit);

      // sterowanie: mysz, dotyk, klawisz
      canvas.addEventListener("mousedown", press);
      window.addEventListener("mouseup", release);
      canvas.addEventListener("touchstart", function (e) { e.preventDefault(); press(); }, { passive: false });
      window.addEventListener("touchend", function (e) { release(); });
      window.addEventListener("keydown", function (e) { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); press(); } });
      window.addEventListener("keyup", function (e) { if (e.code === "Space" || e.code === "ArrowUp") release(); });

      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    },

    start: function () {
      segments = []; coins = []; particles = []; lastCoinX = 0; camX = 0;
      worldEnd = 0;
      pushGround(900, 10); // bezpieczny start
      resetBike(); resetStats();
      state = "running";
      window.Analytics && Analytics.track("game_start", {});
      onStateChange("running", {});
    },

    get state() { return state; },
    setMenu: function () { state = "menu"; onStateChange("menu", {}); }
  };
})();
