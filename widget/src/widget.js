(function () {
  "use strict";

  // ─── Configuration ───
  const SCRIPT_TAG = document.currentScript;
  const TENANT_ID = SCRIPT_TAG?.getAttribute("data-tenant") || "";
  const POSITION = SCRIPT_TAG?.getAttribute("data-position") || "bottom-right";
  const API_BASE =
    SCRIPT_TAG?.getAttribute("data-api") ||
    SCRIPT_TAG?.src.replace(/\/widget\/v1\/widget\.js.*/, "") ||
    "";
  const TERMS_VERSION = "1.0";

  if (!TENANT_ID) {
    console.error("[TinyEclipse] Missing data-tenant attribute");
    return;
  }

  // ─── State ───
  let sessionId = getOrCreateSessionId();
  let hasConsent = false;
  let isOpen = false;
  let conversationId = null;
  let isLoading = false;

  // ─── Session ID ───
  function getOrCreateSessionId() {
    const key = `te_session_${TENANT_ID}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = "ses_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  // ─── Inject CSS ───
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #te-widget-container {
        position: fixed;
        ${POSITION.includes("right") ? "right: 20px;" : "left: 20px;"}
        ${POSITION.includes("top") ? "top: 20px;" : "bottom: 20px;"}
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      #te-toggle-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1a1a2e;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #te-toggle-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      }
      #te-toggle-btn svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      #te-chat-window {
        display: none;
        position: absolute;
        ${POSITION.includes("right") ? "right: 0;" : "left: 0;"}
        ${POSITION.includes("top") ? "top: 70px;" : "bottom: 70px;"}
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 520px;
        max-height: calc(100vh - 100px);
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.2);
        overflow: hidden;
        flex-direction: column;
      }
      #te-chat-window.te-open {
        display: flex;
      }

      #te-chat-header {
        background: #1a1a2e;
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #te-chat-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      #te-close-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 20px;
        padding: 0;
        line-height: 1;
        opacity: 0.7;
      }
      #te-close-btn:hover { opacity: 1; }

      #te-consent-screen {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px;
        text-align: center;
      }
      #te-consent-screen p {
        color: #555;
        margin-bottom: 20px;
        font-size: 13px;
      }
      #te-consent-btn {
        background: #1a1a2e;
        color: white;
        border: none;
        padding: 12px 28px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
      }
      #te-consent-btn:hover { background: #16213e; }

      #te-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .te-msg {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        word-wrap: break-word;
      }
      .te-msg-user {
        align-self: flex-end;
        background: #1a1a2e;
        color: white;
        border-bottom-right-radius: 4px;
      }
      .te-msg-assistant {
        align-self: flex-start;
        background: #f0f0f5;
        color: #1a1a2e;
        border-bottom-left-radius: 4px;
      }
      .te-msg-escalated {
        border-left: 3px solid #e74c3c;
      }

      .te-typing {
        align-self: flex-start;
        background: #f0f0f5;
        padding: 10px 14px;
        border-radius: 12px;
        border-bottom-left-radius: 4px;
        display: flex;
        gap: 4px;
      }
      .te-typing span {
        width: 6px;
        height: 6px;
        background: #999;
        border-radius: 50%;
        animation: te-bounce 1.2s infinite;
      }
      .te-typing span:nth-child(2) { animation-delay: 0.2s; }
      .te-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes te-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }

      #te-input-area {
        display: flex;
        padding: 12px;
        border-top: 1px solid #eee;
        gap: 8px;
      }
      #te-input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        outline: none;
        font-family: inherit;
        resize: none;
      }
      #te-input:focus { border-color: #1a1a2e; }
      #te-send-btn {
        background: #1a1a2e;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.2s;
      }
      #te-send-btn:hover { background: #16213e; }
      #te-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .te-confidence {
        font-size: 10px;
        color: #999;
        margin-top: 4px;
      }

      @media (max-width: 440px) {
        #te-chat-window {
          width: calc(100vw - 20px);
          height: calc(100vh - 80px);
          ${POSITION.includes("right") ? "right: -10px;" : "left: -10px;"}
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
          <h3>AI Assistant</h3>
          <button id="te-close-btn">&times;</button>
        </div>
        <div id="te-consent-screen">
          <p>This chat uses AI to assist you. By continuing, you agree to our AI Terms of Service. Your conversation may be logged for quality and training purposes.</p>
          <button id="te-consent-btn">I Agree — Start Chat</button>
        </div>
        <div id="te-messages" style="display:none;"></div>
        <div id="te-input-area" style="display:none;">
          <input id="te-input" type="text" placeholder="Type your message..." autocomplete="off" />
          <button id="te-send-btn">Send</button>
        </div>
      </div>
      <button id="te-toggle-btn" aria-label="Open chat">
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
    win.classList.toggle("te-open", isOpen);

    if (isOpen && !hasConsent) {
      checkConsent();
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
    document.getElementById("te-input").focus();

    // Welcome message
    const msgs = document.getElementById("te-messages");
    if (msgs.children.length === 0) {
      addMessage("assistant", "Hello! How can I help you today?");
    }
  }

  // ─── Messages ───
  function addMessage(role, content, confidence, escalated) {
    const msgs = document.getElementById("te-messages");
    const div = document.createElement("div");
    div.className = `te-msg te-msg-${role}${escalated ? " te-msg-escalated" : ""}`;
    div.textContent = content;

    if (role === "assistant" && confidence !== undefined) {
      const conf = document.createElement("div");
      conf.className = "te-confidence";
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
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addMessage("assistant", err.detail || "Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      conversationId = data.conversation_id;
      addMessage("assistant", data.message, data.confidence, data.escalated);
    } catch (e) {
      hideTyping();
      addMessage("assistant", "Connection error. Please try again.");
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
