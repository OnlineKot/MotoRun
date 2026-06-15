/* =========================================================================
 *  MotoRun – Analytics (Google Analytics gtag.js + Microsoft Clarity)
 *  Ładuje skrypty dynamicznie tylko jeśli ID są ustawione w config.js.
 * ========================================================================= */

(function () {
  const CFG = window.MOTORUN_CONFIG;

  /* ---------- Google Analytics 4 (gtag.js) ---------- */
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  if (CFG.isGAEnabled) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + CFG.GA_MEASUREMENT_ID;
    document.head.appendChild(s);

    gtag("js", new Date());
    gtag("config", CFG.GA_MEASUREMENT_ID, { send_page_view: true });
    console.info("[MotoRun] Google Analytics aktywny:", CFG.GA_MEASUREMENT_ID);
  } else {
    console.info("[MotoRun] Google Analytics WYŁĄCZONY (ustaw GA_MEASUREMENT_ID w config.js).");
  }

  /* ---------- Microsoft Clarity ---------- */
  if (CFG.isClarityEnabled) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CFG.CLARITY_PROJECT_ID);
    console.info("[MotoRun] Microsoft Clarity aktywny:", CFG.CLARITY_PROJECT_ID);
  } else {
    console.info("[MotoRun] Microsoft Clarity WYŁĄCZONY (ustaw CLARITY_PROJECT_ID w config.js).");
  }

  /* ---------- Wspólny helper do logowania zdarzeń ---------- */
  window.Analytics = {
    /** Wyślij zdarzenie do GA4 i otaguj sesję w Clarity. */
    track: function (eventName, params) {
      params = params || {};
      try { if (window.gtag) gtag("event", eventName, params); } catch (e) {}
      try {
        if (window.clarity) {
          window.clarity("event", eventName);
          // Najważniejsze wartości jako tagi sesji Clarity:
          Object.keys(params).forEach(function (k) {
            window.clarity("set", k, String(params[k]));
          });
        }
      } catch (e) {}
    },
    /** Ustaw identyfikator zalogowanego użytkownika (dla obu narzędzi). */
    identify: function (userId, props) {
      try { if (window.gtag) gtag("set", { user_id: userId }); } catch (e) {}
      try { if (window.clarity) window.clarity("identify", userId); } catch (e) {}
      if (props) {
        try { if (window.gtag) gtag("set", "user_properties", props); } catch (e) {}
      }
    }
  };
})();
