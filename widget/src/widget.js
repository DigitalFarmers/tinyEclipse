/**
 * TinyEclipse Smart Widget v2.0
 * AI Chat + Visitor Tracking + Proactive Help + Behavior Monitoring
 * (c) 2026 Digital Farmers — Powered by TinyEclipse
 */
(function () {
  "use strict";

  // ─── Configuration ───
  const SCRIPT_TAG = document.currentScript;
  const TENANT_ID = SCRIPT_TAG?.getAttribute("data-tenant") || "";
  const POSITION = SCRIPT_TAG?.getAttribute("data-position") || "bottom-right";
  const THEME_COLOR = SCRIPT_TAG?.getAttribute("data-color") || "#6C3CE1";
  const BRAND_NAME = SCRIPT_TAG?.getAttribute("data-name") || "AI Assistant";
  const LANG = SCRIPT_TAG?.getAttribute("data-lang") || "nl";
  const API_BASE =
    SCRIPT_TAG?.getAttribute("data-api") ||
    SCRIPT_TAG?.src.replace(/\/widget\/v1\/widget\.js.*/, "") ||
    "";
  const TERMS_VERSION = "1.0";

  if (!TENANT_ID) {
    console.error("[TinyEclipse] Missing data-tenant attribute");
    return;
  }

  // ─── i18n ───
  const STRINGS = {
    nl: {
      welcome: "Hallo! Hoe kan ik je helpen?",
      consent: "Deze chat gebruikt AI om je te helpen. Door verder te gaan, ga je akkoord met onze voorwaarden.",
      consentBtn: "Akkoord — Start Chat",
      placeholder: "Typ je bericht...",
      send: "Verstuur",
      proactiveIdle: "Ik zie dat je even stilstaat. Kan ik je ergens mee helpen?",
      proactiveExit: "Wacht! Heb je nog een vraag voor je vertrekt?",
      proactiveScroll: "Zoek je iets specifieks? Ik help je graag!",
      poweredBy: "Powered by TinyEclipse",
      connectionError: "Verbindingsfout. Probeer opnieuw.",
      error: "Er ging iets mis. Probeer opnieuw.",
    },
    en: {
      welcome: "Hello! How can I help you?",
      consent: "This chat uses AI to assist you. By continuing, you agree to our terms.",
      consentBtn: "I Agree — Start Chat",
      placeholder: "Type your message...",
      send: "Send",
      proactiveIdle: "I notice you've been here a while. Can I help with anything?",
      proactiveExit: "Wait! Do you have any questions before you go?",
      proactiveScroll: "Looking for something specific? I'd love to help!",
      poweredBy: "Powered by TinyEclipse",
      connectionError: "Connection error. Please try again.",
      error: "Something went wrong. Please try again.",
    },
    fr: {
      welcome: "Bonjour! Comment puis-je vous aider?",
      consent: "Ce chat utilise l'IA pour vous aider. En continuant, vous acceptez nos conditions.",
      consentBtn: "J'accepte — Démarrer",
      placeholder: "Tapez votre message...",
      send: "Envoyer",
      proactiveIdle: "Je vois que vous hésitez. Puis-je vous aider?",
      proactiveExit: "Attendez! Avez-vous une question avant de partir?",
      proactiveScroll: "Vous cherchez quelque chose? Je peux vous aider!",
      poweredBy: "Powered by TinyEclipse",
      connectionError: "Erreur de connexion. Réessayez.",
      error: "Quelque chose s'est mal passé. Réessayez.",
    },
  };
  const t = STRINGS[LANG] || STRINGS.nl;

  // ─── State ───
  let sessionId = getOrCreateSessionId();
  let visitorId = getOrCreateVisitorId();
  let hasConsent = false;
  let isOpen = false;
  let conversationId = null;
  let isLoading = false;
  let sessionStarted = false;
  let proactiveShown = false;
  let currentPath = location.pathname;
  let pageEnterTime = Date.now();
  let scrollMax = 0;
  let clickCount = 0;
  let idleTimer = null;
  let idleSeconds = 0;
  let pageUpdateInterval = null;

  // ─── IDs ───
  function getOrCreateSessionId() {
    const key = `te_session_${TENANT_ID}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = "ses_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function getOrCreateVisitorId() {
    const key = `te_visitor_${TENANT_ID}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = "vis_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  }

  // ─── Tracking API ───
  function track(endpoint, data) {
    const payload = { tenant_id: TENANT_ID, session_id: sessionId, ...data };
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE}/api/track/${endpoint}`, blob);
    } else {
      fetch(`${API_BASE}/api/track/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }

  function startSession() {
    if (sessionStarted) return;
    sessionStarted = true;

    const params = new URLSearchParams(location.search);
    track("session", {
      visitor_id: visitorId,
      referrer: document.referrer || null,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      landing_page: location.href,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : /Tablet|iPad/i.test(navigator.userAgent) ? "tablet" : "desktop",
      browser: getBrowser(),
      os: getOS(),
      screen_width: screen.width,
      screen_height: screen.height,
      language: navigator.language?.substring(0, 5),
    });

    trackPageView();
  }

  function trackPageView() {
    pageEnterTime = Date.now();
    scrollMax = 0;
    clickCount = 0;
    currentPath = location.pathname;

    track("pageview", {
      url: location.href,
      path: location.pathname,
      title: document.title,
    });
  }

  function sendPageUpdate() {
    const timeOnPage = Math.round((Date.now() - pageEnterTime) / 1000);
    track("page-update", {
      path: currentPath,
      time_on_page_seconds: timeOnPage,
      scroll_depth_percent: scrollMax,
      clicks: clickCount,
    });
  }

  function trackEvent(eventType, extra) {
    track("event", {
      event_type: eventType,
      page_path: location.pathname,
      ...extra,
    });
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Other";
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (ua.includes("Win")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Other";
  }

  // ─── Behavior Monitoring ───
  function setupBehaviorTracking() {
    // Scroll depth
    window.addEventListener("scroll", function () {
      const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((window.scrollY / docHeight) * 100);
        scrollMax = Math.max(scrollMax, Math.min(pct, 100));
      }
      resetIdle();
    }, { passive: true });

    // Click tracking
    document.addEventListener("click", function (e) {
      clickCount++;
      resetIdle();

      // Rage click detection (5+ clicks in 2 seconds on same area)
      if (!this._clickLog) this._clickLog = [];
      const now = Date.now();
      this._clickLog.push({ x: e.clientX, y: e.clientY, t: now });
      this._clickLog = this._clickLog.filter(c => now - c.t < 2000);
      if (this._clickLog.length >= 5) {
        trackEvent("rage_click", { element: describeElement(e.target) });
        this._clickLog = [];
      }
    });

    // Form interactions
    document.addEventListener("focusin", function (e) {
      if (e.target.matches("input, textarea, select")) {
        const form = e.target.closest("form");
        if (form && !form._teTracked) {
          form._teTracked = true;
          trackEvent("form_start", { element: describeElement(form) });
        }
      }
    });

    document.addEventListener("submit", function (e) {
      trackEvent("form_submit", { element: describeElement(e.target) });
    });

    // Exit intent (mouse leaves viewport at top)
    document.addEventListener("mouseout", function (e) {
      if (e.clientY < 5 && !proactiveShown) {
        trackEvent("exit_intent");
        showProactiveMessage(t.proactiveExit);
      }
    });

    // Idle detection
    resetIdle();
    setInterval(function () {
      idleSeconds++;
      if (idleSeconds >= 30 && !proactiveShown && !isOpen) {
        trackEvent("idle", { metadata: { seconds: idleSeconds } });
        showProactiveMessage(t.proactiveIdle);
      }
    }, 1000);

    // Page update every 10 seconds
    pageUpdateInterval = setInterval(sendPageUpdate, 10000);

    // SPA navigation detection
    let lastPath = location.pathname;
    const observer = new MutationObserver(function () {
      if (location.pathname !== lastPath) {
        sendPageUpdate(); // Send update for previous page
        lastPath = location.pathname;
        trackPageView();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Session end on page unload
    window.addEventListener("beforeunload", function () {
      sendPageUpdate();
      const duration = Math.round((Date.now() - (sessionStorage.getItem(`te_start_${TENANT_ID}`) || Date.now())) / 1000);
      track("session-end", { duration_seconds: duration });
    });

    // Store session start time
    if (!sessionStorage.getItem(`te_start_${TENANT_ID}`)) {
      sessionStorage.setItem(`te_start_${TENANT_ID}`, Date.now().toString());
    }
  }

  function resetIdle() {
    idleSeconds = 0;
  }

  function describeElement(el) {
    if (!el) return "unknown";
    let desc = el.tagName.toLowerCase();
    if (el.id) desc += "#" + el.id;
    if (el.className && typeof el.className === "string") desc += "." + el.className.split(" ").slice(0, 2).join(".");
    return desc.substring(0, 200);
  }

  // ─── Proactive Messages ───
  function showProactiveMessage(message) {
    if (proactiveShown || isOpen) return;
    proactiveShown = true;

    const bubble = document.createElement("div");
    bubble.id = "te-proactive-bubble";
    bubble.innerHTML = `
      <div class="te-proactive-content">
        <div class="te-proactive-avatar">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${THEME_COLOR}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>
        <p>${message}</p>
        <button class="te-proactive-close">&times;</button>
      </div>
    `;
    document.getElementById("te-widget-container").appendChild(bubble);

    // Animate in
    requestAnimationFrame(() => bubble.classList.add("te-proactive-visible"));

    bubble.querySelector("p").addEventListener("click", function () {
      bubble.remove();
      toggleChat();
    });
    bubble.querySelector(".te-proactive-close").addEventListener("click", function (e) {
      e.stopPropagation();
      bubble.remove();
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 15000);
  }

  // ─── Inject CSS ───
  function injectStyles() {
    const isRight = POSITION.includes("right");
    const isTop = POSITION.includes("top");
    const style = document.createElement("style");
    style.textContent = `
      #te-widget-container {
        position: fixed;
        ${isRight ? "right: 20px;" : "left: 20px;"}
        ${isTop ? "top: 20px;" : "bottom: 20px;"}
        z-index: 999999;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      /* ─── Toggle Button ─── */
      #te-toggle-btn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${THEME_COLOR};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 24px ${THEME_COLOR}44;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }
      #te-toggle-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 32px ${THEME_COLOR}66;
      }
      #te-toggle-btn svg { width: 26px; height: 26px; fill: white; transition: transform 0.3s; }
      #te-toggle-btn.te-active svg { transform: rotate(90deg); }

      #te-toggle-btn .te-pulse {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: ${THEME_COLOR};
        animation: te-pulse-anim 2s infinite;
        z-index: -1;
      }
      @keyframes te-pulse-anim {
        0% { transform: scale(1); opacity: 0.4; }
        100% { transform: scale(1.6); opacity: 0; }
      }

      /* ─── Chat Window ─── */
      #te-chat-window {
        display: none;
        position: absolute;
        ${isRight ? "right: 0;" : "left: 0;"}
        ${isTop ? "top: 76px;" : "bottom: 76px;"}
        width: 400px;
        max-width: calc(100vw - 40px);
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        overflow: hidden;
        flex-direction: column;
        animation: te-slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes te-slide-in {
        from { opacity: 0; transform: translateY(${isTop ? "-12px" : "12px"}) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #te-chat-window.te-open { display: flex; }

      /* ─── Header ─── */
      #te-chat-header {
        background: ${THEME_COLOR};
        color: white;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .te-header-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .te-header-avatar svg { width: 20px; height: 20px; fill: white; }
      .te-header-info { flex: 1; }
      .te-header-info h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .te-header-info span { font-size: 11px; opacity: 0.8; }
      .te-header-status { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; display: inline-block; margin-right: 4px; }
      #te-close-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      #te-close-btn:hover { background: rgba(255,255,255,0.3); }

      /* ─── Consent ─── */
      #te-consent-screen {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 30px;
        text-align: center;
      }
      .te-consent-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: ${THEME_COLOR}15;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }
      .te-consent-icon svg { width: 32px; height: 32px; fill: ${THEME_COLOR}; }
      #te-consent-screen p { color: #64748b; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
      #te-consent-btn {
        background: ${THEME_COLOR};
        color: white;
        border: none;
        padding: 14px 32px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
        box-shadow: 0 4px 12px ${THEME_COLOR}33;
      }
      #te-consent-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px ${THEME_COLOR}44; }

      /* ─── Messages ─── */
      #te-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        scroll-behavior: smooth;
      }
      #te-messages::-webkit-scrollbar { width: 4px; }
      #te-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

      .te-msg {
        max-width: 82%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 13.5px;
        word-wrap: break-word;
        animation: te-msg-in 0.2s ease-out;
        line-height: 1.5;
      }
      @keyframes te-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .te-msg-user {
        align-self: flex-end;
        background: ${THEME_COLOR};
        color: white;
        border-bottom-right-radius: 6px;
      }
      .te-msg-assistant {
        align-self: flex-start;
        background: #f1f5f9;
        color: #1e293b;
        border-bottom-left-radius: 6px;
      }
      .te-msg-escalated { border-left: 3px solid #ef4444; }
      .te-msg-proactive {
        align-self: flex-start;
        background: linear-gradient(135deg, ${THEME_COLOR}10, ${THEME_COLOR}05);
        border: 1px solid ${THEME_COLOR}20;
        color: #1e293b;
        border-radius: 16px;
        border-bottom-left-radius: 6px;
      }

      .te-typing {
        align-self: flex-start;
        background: #f1f5f9;
        padding: 14px 18px;
        border-radius: 16px;
        border-bottom-left-radius: 6px;
        display: flex;
        gap: 5px;
        align-items: center;
      }
      .te-typing span {
        width: 7px;
        height: 7px;
        background: ${THEME_COLOR}88;
        border-radius: 50%;
        animation: te-bounce 1.4s infinite;
      }
      .te-typing span:nth-child(2) { animation-delay: 0.2s; }
      .te-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes te-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-8px); }
      }

      /* ─── Input ─── */
      #te-input-area {
        display: flex;
        padding: 14px 16px;
        border-top: 1px solid #f1f5f9;
        gap: 10px;
        align-items: flex-end;
        background: #fafbfc;
      }
      #te-input {
        flex: 1;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        padding: 11px 16px;
        font-size: 13.5px;
        outline: none;
        font-family: inherit;
        resize: none;
        background: white;
        transition: border-color 0.2s, box-shadow 0.2s;
        max-height: 100px;
      }
      #te-input:focus { border-color: ${THEME_COLOR}; box-shadow: 0 0 0 3px ${THEME_COLOR}15; }
      #te-send-btn {
        background: ${THEME_COLOR};
        color: white;
        border: none;
        border-radius: 12px;
        width: 42px;
        height: 42px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      #te-send-btn svg { width: 18px; height: 18px; fill: white; }
      #te-send-btn:hover { transform: scale(1.05); }
      #te-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      /* ─── Footer ─── */
      .te-footer {
        text-align: center;
        padding: 6px;
        font-size: 10px;
        color: #94a3b8;
        background: #fafbfc;
      }
      .te-footer a { color: #94a3b8; text-decoration: none; }
      .te-footer a:hover { color: ${THEME_COLOR}; }

      /* ─── Proactive Bubble ─── */
      #te-proactive-bubble {
        position: absolute;
        ${isRight ? "right: 0;" : "left: 0;"}
        ${isTop ? "top: 76px;" : "bottom: 76px;"}
        opacity: 0;
        transform: translateY(${isTop ? "-8px" : "8px"}) scale(0.95);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #te-proactive-bubble.te-proactive-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .te-proactive-content {
        background: white;
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 320px;
        cursor: pointer;
        border: 1px solid ${THEME_COLOR}20;
      }
      .te-proactive-content:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
      .te-proactive-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${THEME_COLOR}15;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .te-proactive-content p { margin: 0; font-size: 13px; color: #334155; line-height: 1.4; flex: 1; }
      .te-proactive-close {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        line-height: 1;
        flex-shrink: 0;
      }

      /* ─── Mobile ─── */
      @media (max-width: 480px) {
        #te-chat-window {
          width: calc(100vw - 16px);
          height: calc(100vh - 100px);
          ${isRight ? "right: -12px;" : "left: -12px;"}
          border-radius: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Build DOM ───
  function buildWidget() {
    const container = document.createElement("div");
    container.id = "te-widget-container";
    container.innerHTML = `
      <div id="te-chat-window">
        <div id="te-chat-header">
          <div class="te-header-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <div class="te-header-info">
            <h3>${BRAND_NAME}</h3>
            <span><span class="te-header-status"></span>Online</span>
          </div>
          <button id="te-close-btn">&times;</button>
        </div>
        <div id="te-consent-screen">
          <div class="te-consent-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <p>${t.consent}</p>
          <button id="te-consent-btn">${t.consentBtn}</button>
        </div>
        <div id="te-messages" style="display:none;"></div>
        <div id="te-input-area" style="display:none;">
          <input id="te-input" type="text" placeholder="${t.placeholder}" autocomplete="off" />
          <button id="te-send-btn">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="te-footer" style="display:none;"><a href="https://tinyeclipse.digitalfarmers.be" target="_blank">${t.poweredBy}</a></div>
      </div>
      <button id="te-toggle-btn" aria-label="Open chat">
        <div class="te-pulse"></div>
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
    `;
    document.body.appendChild(container);

    // Event listeners
    document.getElementById("te-toggle-btn").addEventListener("click", toggleChat);
    document.getElementById("te-close-btn").addEventListener("click", toggleChat);
    document.getElementById("te-consent-btn").addEventListener("click", giveConsent);
    document.getElementById("te-send-btn").addEventListener("click", sendMessage);
    document.getElementById("te-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ─── Toggle ───
  function toggleChat() {
    isOpen = !isOpen;
    const win = document.getElementById("te-chat-window");
    const btn = document.getElementById("te-toggle-btn");
    win.classList.toggle("te-open", isOpen);
    btn.classList.toggle("te-active", isOpen);

    // Remove pulse after first open
    const pulse = btn.querySelector(".te-pulse");
    if (pulse) pulse.remove();

    // Remove proactive bubble
    const bubble = document.getElementById("te-proactive-bubble");
    if (bubble) bubble.remove();

    if (isOpen) {
      trackEvent("chat_open");
      if (!hasConsent) checkConsent();
    }
  }

  // ─── Consent ───
  async function checkConsent() {
    try {
      const res = await fetch(
        `${API_BASE}/api/consent/check?tenant_id=${TENANT_ID}&session_id=${sessionId}`
      );
      const data = await res.json();
      if (data.has_consent) {
        hasConsent = true;
        showChat();
      }
    } catch (e) {
      console.error("[TinyEclipse] Consent check failed:", e);
    }
  }

  async function giveConsent() {
    try {
      const res = await fetch(`${API_BASE}/api/consent/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          session_id: sessionId,
          accepted: true,
          terms_version: TERMS_VERSION,
        }),
      });
      if (res.ok) {
        hasConsent = true;
        showChat();
      }
    } catch (e) {
      console.error("[TinyEclipse] Consent submission failed:", e);
    }
  }

  function showChat() {
    document.getElementById("te-consent-screen").style.display = "none";
    document.getElementById("te-messages").style.display = "flex";
    document.getElementById("te-input-area").style.display = "flex";
    document.querySelector(".te-footer").style.display = "block";
    document.getElementById("te-input").focus();

    const msgs = document.getElementById("te-messages");
    if (msgs.children.length === 0) {
      addMessage("assistant", t.welcome);
    }
  }

  // ─── Messages ───
  function addMessage(role, content, confidence, escalated) {
    const msgs = document.getElementById("te-messages");
    const div = document.createElement("div");
    div.className = `te-msg te-msg-${role}${escalated ? " te-msg-escalated" : ""}`;
    div.textContent = content;

    if (role === "assistant" && confidence !== undefined && confidence < 0.9) {
      const conf = document.createElement("div");
      conf.style.cssText = "font-size:10px;color:#94a3b8;margin-top:4px;";
      conf.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
      div.appendChild(conf);
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById("te-messages");
    const div = document.createElement("div");
    div.className = "te-typing";
    div.id = "te-typing-indicator";
    div.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("te-typing-indicator");
    if (el) el.remove();
  }

  // ─── Send Message ───
  async function sendMessage() {
    if (isLoading) return;

    const input = document.getElementById("te-input");
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    addMessage("user", message);
    trackEvent("chat_message", { value: message.substring(0, 100) });
    isLoading = true;
    document.getElementById("te-send-btn").disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          session_id: sessionId,
          message: message,
          channel: "widget",
        }),
      });

      hideTyping();

      if (res.status === 451) {
        hasConsent = false;
        document.getElementById("te-consent-screen").style.display = "flex";
        document.getElementById("te-messages").style.display = "none";
        document.getElementById("te-input-area").style.display = "none";
        document.querySelector(".te-footer").style.display = "none";
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addMessage("assistant", err.detail || t.error);
        return;
      }

      const data = await res.json();
      conversationId = data.conversation_id;
      addMessage("assistant", data.message, data.confidence, data.escalated);
    } catch (e) {
      hideTyping();
      addMessage("assistant", t.connectionError);
      console.error("[TinyEclipse] Chat error:", e);
    } finally {
      isLoading = false;
      document.getElementById("te-send-btn").disabled = false;
      document.getElementById("te-input").focus();
    }
  }

  // ─── Initialize ───
  function init() {
    injectStyles();
    buildWidget();
    startSession();
    setupBehaviorTracking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
