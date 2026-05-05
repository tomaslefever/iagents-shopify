/**
 * iAgents Chat Widget — Embeddable chat bubble for external websites
 * Usage:
 *   <script src="https://dashboard.iagents.pro/widget/iagents-chat.js"
 *           data-agent-id="YOUR_AGENT_ID"></script>
 *
 * Webhook response formats supported:
 *   { "output": "Plain text reply" }
 *   { "output": "Check this out", "link": "https://example.com/product/123" }
 *   { "output": "Here are some options", "links": ["https://...", "https://..."] }
 *
 * Uses Shadow DOM for full style isolation.
 * Persists chat sessions in localStorage with multi-session history.
 */
(function () {
  "use strict";

  const WEBHOOK_BASE_URL = "https://api.iagents.pro/webhook";
  const OG_PREVIEW_URL =
    "https://uajcfgpxkyneeraiqoyg.supabase.co/functions/v1/og-preview";

  const scriptTag =
    document.currentScript || document.querySelector("script[data-agent-id]");

  if (!scriptTag) {
    console.error("[iAgents] Missing data-agent-id attribute on script tag.");
    return;
  }

  const AGENT_ID = scriptTag.getAttribute("data-agent-id");
  const PRIMARY_COLOR = scriptTag.getAttribute("data-color") || "#7c3aed";
  const POSITION = scriptTag.getAttribute("data-position") || "right";
  const WELCOME_MESSAGE =
    scriptTag.getAttribute("data-welcome") || "Hi! How can I help you?";
  const TITLE = scriptTag.getAttribute("data-title") || "Chat";
  const SUBTITLE =
    scriptTag.getAttribute("data-subtitle") || "Online · Replies instantly";
  const AVATAR_URL = scriptTag.getAttribute("data-avatar") || "";
  const THEME =
    (scriptTag.getAttribute("data-theme") || "light").toLowerCase() === "dark"
      ? "dark"
      : "light";
  const SOURCE = scriptTag.getAttribute("data-source") || "web-widget";
  const CHANNEL = scriptTag.getAttribute("data-channel") || "web";

  if (!AGENT_ID) {
    console.error("[iAgents] data-agent-id is required.");
    return;
  }

  // ---------- Persistence (localStorage) ----------
  const STORAGE_KEY = `iagents:widget:${AGENT_ID}`;

  function newSessionId() {
    return "widget-" + Math.random().toString(36).substring(2, 15) + Date.now();
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sessions) && parsed.activeId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("[iAgents] Failed to load storage:", e);
    }
    const id = newSessionId();
    return {
      activeId: id,
      sessions: [{ id, createdAt: Date.now(), updatedAt: Date.now(), messages: [] }],
    };
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn("[iAgents] Failed to save storage:", e);
    }
  }

  // Lighten/darken helper for header gradient
  function adjustColor(hex, percent) {
    const h = hex.replace("#", "");
    const num = parseInt(
      h.length === 3
        ? h.split("").map((c) => c + c).join("")
        : h,
      16,
    );
    let r = (num >> 16) + Math.round(2.55 * percent);
    let g = ((num >> 8) & 0x00ff) + Math.round(2.55 * percent);
    let b = (num & 0x0000ff) + Math.round(2.55 * percent);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const PRIMARY_LIGHT = adjustColor(PRIMARY_COLOR, 18);
  const PRIMARY_DARK = adjustColor(PRIMARY_COLOR, -10);

  // Theme tokens — light & dark
  const THEME_TOKENS = {
    light: {
      windowBg: "#ffffff",
      messagesBg: "#f8fafc",
      inputAreaBg: "#ffffff",
      inputBg: "#f1f5f9",
      inputBgFocus: "#ffffff",
      text: "#0f172a",
      textMuted: "#64748b",
      textPlaceholder: "#94a3b8",
      border: "rgba(15, 23, 42, 0.06)",
      borderStrong: "rgba(15, 23, 42, 0.08)",
      agentMsgBg: "#ffffff",
      cardBg: "#ffffff",
      cardHoverBg: "#f8fafc",
      skelFrom: "#f1f5f9",
      skelTo: "#e2e8f0",
      shadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
      windowShadow: "0 30px 80px rgba(15, 23, 42, 0.22), 0 10px 24px rgba(15, 23, 42, 0.08)",
      cardHoverShadow: "0 6px 16px rgba(15, 23, 42, 0.1)",
      scrollbar: "rgba(15, 23, 42, 0.15)",
      onlineDotBorder: "#fff",
      readonlyBg: "#f1f5f9",
    },
    dark: {
      windowBg: "#0f172a",
      messagesBg: "#0b1220",
      inputAreaBg: "#0f172a",
      inputBg: "#1e293b",
      inputBgFocus: "#1e293b",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      textPlaceholder: "#64748b",
      border: "rgba(255, 255, 255, 0.06)",
      borderStrong: "rgba(255, 255, 255, 0.1)",
      agentMsgBg: "#1e293b",
      cardBg: "#1e293b",
      cardHoverBg: "#293548",
      skelFrom: "#1e293b",
      skelTo: "#334155",
      shadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
      windowShadow: "0 30px 80px rgba(0, 0, 0, 0.5), 0 10px 24px rgba(0, 0, 0, 0.3)",
      cardHoverShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
      scrollbar: "rgba(255, 255, 255, 0.15)",
      onlineDotBorder: "#0f172a",
      readonlyBg: "#1e293b",
    },
  };
  const T = THEME_TOKENS[THEME];

  const STYLES = `
    :host, :host * { box-sizing: border-box; }
    .root {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: ${T.text};
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating bubble */
    .bubble {
      position: fixed;
      bottom: 24px;
      ${POSITION === "left" ? "left: 24px;" : "right: 24px;"}
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${PRIMARY_LIGHT}, ${PRIMARY_COLOR});
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 30px ${PRIMARY_COLOR}55, 0 4px 12px rgba(15, 23, 42, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
      padding: 0;
    }
    .bubble:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 14px 36px ${PRIMARY_COLOR}66, 0 6px 16px rgba(15, 23, 42, 0.16);
    }
    .bubble svg { width: 28px; height: 28px; fill: #fff; }
    .bubble .icon-close { display: none; }
    .bubble.open .icon-chat { display: none; }
    .bubble.open .icon-close { display: block; }

    /* Chat window */
    .window {
      position: fixed;
      bottom: 100px;
      ${POSITION === "left" ? "left: 24px;" : "right: 24px;"}
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 600px;
      max-height: calc(100vh - 130px);
      border-radius: 24px;
      background: ${T.windowBg};
      box-shadow: ${T.windowShadow};
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      transform-origin: ${POSITION === "left" ? "bottom left" : "bottom right"};
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .window.open {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    /* Header with gradient */
    .header {
      padding: 18px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
      background: linear-gradient(135deg, ${PRIMARY_LIGHT} 0%, ${PRIMARY_COLOR} 60%, ${PRIMARY_DARK} 100%);
      color: #fff;
      position: relative;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar::after {
      content: '';
      position: absolute;
      bottom: 0px;
      right: 0px;
      width: 11px;
      height: 11px;
      background: #22c55e;
      border-radius: 50%;
      border: 2px solid ${T.onlineDotBorder};
    }
    .header-text { min-width: 0; }
    .title {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      margin: 0;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .subtitle {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.85);
      margin: 3px 0 0;
      line-height: 1.2;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .icon-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      padding: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .icon-btn:hover { background: rgba(255, 255, 255, 0.18); }
    .icon-btn svg { width: 18px; height: 18px; }

    /* Body container — switches between chat & history */
    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
    }

    /* Messages area */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: ${T.messagesBg};
      scrollbar-width: thin;
      scrollbar-color: ${T.scrollbar} transparent;
    }
    .messages::-webkit-scrollbar { width: 6px; }
    .messages::-webkit-scrollbar-track { background: transparent; }
    .messages::-webkit-scrollbar-thumb {
      background: ${T.scrollbar};
      border-radius: 3px;
    }

    .row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 85%;
      animation: fadeUp 0.25s ease;
    }
    .row.user { align-self: flex-end; align-items: flex-end; }
    .row.agent { align-self: flex-start; align-items: flex-start; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg {
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
      max-width: 100%;
    }
    .msg.agent {
      background: ${T.agentMsgBg};
      color: ${T.text};
      border-radius: 18px 18px 18px 4px;
      box-shadow: ${T.shadow};
    }
    .msg.user {
      background: linear-gradient(135deg, ${PRIMARY_LIGHT}, ${PRIMARY_COLOR});
      color: #fff;
      border-radius: 18px 18px 4px 18px;
    }
    .msg a { color: inherit; text-decoration: underline; }

    /* Link card */
    .link-card {
      display: block;
      max-width: 280px;
      background: ${T.cardBg};
      border: 1px solid ${T.borderStrong};
      border-radius: 14px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
      box-shadow: ${T.shadow};
    }
    .link-card:hover {
      transform: translateY(-1px);
      box-shadow: ${T.cardHoverShadow};
      border-color: ${PRIMARY_COLOR}55;
    }
    .link-card-img {
      width: 100%;
      aspect-ratio: 1.91 / 1;
      background: ${T.skelFrom};
      object-fit: cover;
      display: block;
    }
    .link-card-img-placeholder {
      width: 100%;
      aspect-ratio: 1.91 / 1;
      background: linear-gradient(135deg, ${PRIMARY_LIGHT}22, ${PRIMARY_COLOR}33);
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${PRIMARY_COLOR};
    }
    .link-card-img-placeholder svg { width: 40px; height: 40px; opacity: 0.7; }
    .link-card-body { padding: 10px 12px 12px; }
    .link-card-site {
      font-size: 11px;
      color: ${T.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 600;
      margin: 0 0 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .link-card-site img { width: 14px; height: 14px; border-radius: 3px; }
    .link-card-title {
      font-size: 13px;
      font-weight: 600;
      color: ${T.text};
      margin: 0 0 4px;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .link-card-desc {
      font-size: 12px;
      color: ${T.textMuted};
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .link-card-skeleton {
      max-width: 280px;
      background: ${T.cardBg};
      border: 1px solid ${T.borderStrong};
      border-radius: 14px;
      overflow: hidden;
    }
    .skel-img {
      width: 100%;
      aspect-ratio: 1.91 / 1;
      background: linear-gradient(90deg, ${T.skelFrom} 25%, ${T.skelTo} 50%, ${T.skelFrom} 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skel-line {
      height: 10px;
      background: linear-gradient(90deg, ${T.skelFrom} 25%, ${T.skelTo} 50%, ${T.skelFrom} 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      margin: 8px 12px;
    }
    .skel-line.short { width: 40%; }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Typing indicator */
    .typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 12px 16px;
      background: ${T.agentMsgBg};
      border-radius: 18px 18px 18px 4px;
      box-shadow: ${T.shadow};
    }
    .typing span {
      width: 7px;
      height: 7px;
      background: ${T.textPlaceholder};
      border-radius: 50%;
      animation: dot 1.2s infinite;
    }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Input area — textarea with rounded send button inside */
    .input-area {
      padding: 12px 14px 14px;
      background: ${T.inputAreaBg};
      border-top: 1px solid ${T.border};
      flex-shrink: 0;
    }
    .input-wrapper {
      position: relative;
      width: 100%;
      background: ${T.inputBg};
      border-radius: 20px;
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .input-wrapper:focus-within {
      border-color: ${PRIMARY_COLOR};
      background: ${T.inputBgFocus};
      box-shadow: 0 0 0 3px ${PRIMARY_COLOR}1f;
    }
    .input {
      width: 100%;
      border: none;
      background: transparent;
      padding: 12px 52px 12px 16px;
      font-size: 14px;
      font-family: inherit;
      color: ${T.text};
      outline: none;
      resize: none;
      line-height: 1.4;
      min-height: 44px;
      max-height: 120px;
      display: block;
    }
    .input::placeholder { color: ${T.textPlaceholder}; }

    .send {
      position: absolute;
      right: 6px;
      bottom: 6px;
      background: linear-gradient(135deg, ${PRIMARY_LIGHT}, ${PRIMARY_COLOR});
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s, opacity 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 8px ${PRIMARY_COLOR}55;
    }
    .send:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px ${PRIMARY_COLOR}77;
    }
    .send:active:not(:disabled) { transform: scale(0.95); }
    .send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }
    .send svg { width: 16px; height: 16px; }

    /* Read-only banner (when viewing past sessions) */
    .readonly-banner {
      padding: 10px 14px;
      background: ${T.readonlyBg};
      border-top: 1px solid ${T.border};
      color: ${T.textMuted};
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .readonly-banner svg { width: 14px; height: 14px; }

    .powered {
      text-align: center;
      padding: 6px 8px 10px;
      font-size: 11px;
      color: ${T.textPlaceholder};
      background: ${T.inputAreaBg};
    }
    .powered a {
      color: ${PRIMARY_COLOR};
      text-decoration: none;
      font-weight: 500;
    }
    .powered a:hover { text-decoration: underline; }

    /* History view */
    .history {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      background: ${T.messagesBg};
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: ${T.scrollbar} transparent;
    }
    .history::-webkit-scrollbar { width: 6px; }
    .history::-webkit-scrollbar-thumb { background: ${T.scrollbar}; border-radius: 3px; }
    .history-empty {
      text-align: center;
      color: ${T.textMuted};
      font-size: 13px;
      padding: 40px 20px;
    }
    .session-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: ${T.cardBg};
      border: 1px solid ${T.borderStrong};
      border-radius: 14px;
      cursor: pointer;
      transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s, background 0.15s;
      text-align: left;
      width: 100%;
      font-family: inherit;
      color: ${T.text};
    }
    .session-card:hover {
      background: ${T.cardHoverBg};
      border-color: ${PRIMARY_COLOR}55;
      box-shadow: ${T.cardHoverShadow};
    }
    .session-card.active {
      border-color: ${PRIMARY_COLOR};
      box-shadow: 0 0 0 2px ${PRIMARY_COLOR}26;
    }
    .session-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, ${PRIMARY_LIGHT}26, ${PRIMARY_COLOR}33);
      color: ${PRIMARY_COLOR};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .session-icon svg { width: 18px; height: 18px; }
    .session-info { flex: 1; min-width: 0; }
    .session-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .session-date {
      font-size: 13px;
      font-weight: 600;
      color: ${T.text};
    }
    .session-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: ${PRIMARY_COLOR};
      background: ${PRIMARY_COLOR}1a;
      padding: 2px 7px;
      border-radius: 999px;
    }
    .session-meta {
      font-size: 12px;
      color: ${T.textMuted};
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 480px) {
      .window {
        width: calc(100vw - 24px);
        height: calc(100vh - 110px);
        bottom: 92px;
        ${POSITION === "left" ? "left: 12px;" : "right: 12px;"}
      }
    }
  `;

  // Simple LRU cache for OG previews per session
  const ogCache = new Map();

  async function fetchOgPreview(url) {
    if (ogCache.has(url)) return ogCache.get(url);
    try {
      const res = await fetch(`${OG_PREVIEW_URL}?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("og fetch failed");
      const data = await res.json();
      ogCache.set(url, data);
      return data;
    } catch (e) {
      console.warn("[iAgents] OG preview failed:", e);
      try {
        const u = new URL(url);
        const fallback = {
          url,
          title: u.hostname,
          description: null,
          image: null,
          siteName: u.hostname.replace(/^www\./, ""),
          favicon: `${u.origin}/favicon.ico`,
        };
        ogCache.set(url, fallback);
        return fallback;
      } catch {
        return null;
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
  }

  function formatSessionDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Hoy · ${time}`;
    if (isYesterday) return `Ayer · ${time}`;
    return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) + ` · ${time}`;
  }

  function init() {
    let isOpen = false;
    let isTyping = false;
    let view = "chat"; // "chat" | "history"
    let store = loadStore();
    let viewingSessionId = store.activeId; // the session currently rendered in chat view

    function getActiveSession() {
      return store.sessions.find((s) => s.id === store.activeId);
    }
    function getViewingSession() {
      return store.sessions.find((s) => s.id === viewingSessionId);
    }
    function isReadonly() {
      return viewingSessionId !== store.activeId;
    }

    const host = document.createElement("div");
    host.id = "iagents-widget-host";
    host.style.cssText = "all: initial;";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    shadow.appendChild(styleEl);

    const root = document.createElement("div");
    root.className = "root";

    const initial = (TITLE.charAt(0) || "C").toUpperCase();
    const avatarInner = AVATAR_URL
      ? `<img src="${escapeHtml(AVATAR_URL)}" alt="${escapeHtml(TITLE)}" />`
      : escapeHtml(initial);

    root.innerHTML = `
      <button class="bubble" data-el="bubble" aria-label="Open chat">
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>
        </svg>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <div class="window" data-el="window" role="dialog" aria-label="Chat window">
        <div class="header">
          <div class="header-left">
            <div class="avatar">${avatarInner}</div>
            <div class="header-text">
              <p class="title">${escapeHtml(TITLE)}</p>
              <p class="subtitle">${escapeHtml(SUBTITLE)}</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn" data-el="new" aria-label="Nueva conversación" title="Nueva conversación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
              </svg>
            </button>
            <button class="icon-btn" data-el="history" aria-label="Historial" title="Historial">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
                <polyline points="3 3 3 8 8 8"></polyline>
                <polyline points="12 7 12 12 15 14"></polyline>
              </svg>
            </button>
            <button class="icon-btn" data-el="close" aria-label="Cerrar chat" title="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="body" data-el="body">
          <div class="messages" data-el="messages"></div>
          <div data-el="footer"></div>
        </div>
      </div>
    `;
    shadow.appendChild(root);

    const bubble = shadow.querySelector('[data-el="bubble"]');
    const chatWindow = shadow.querySelector('[data-el="window"]');
    const closeBtn = shadow.querySelector('[data-el="close"]');
    const newBtn = shadow.querySelector('[data-el="new"]');
    const historyBtn = shadow.querySelector('[data-el="history"]');
    const body = shadow.querySelector('[data-el="body"]');
    const messagesEl = shadow.querySelector('[data-el="messages"]');
    const footerEl = shadow.querySelector('[data-el="footer"]');

    // ---------- Render footer (input or readonly banner) ----------
    function renderFooter() {
      footerEl.innerHTML = "";
      if (view !== "chat") return;

      if (isReadonly()) {
        footerEl.innerHTML = `
          <div class="readonly-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Conversación anterior · sólo lectura</span>
          </div>
          <div class="powered">Powered by <a href="https://iagents.pro" target="_blank" rel="noopener">iAgents</a></div>
        `;
      } else {
        footerEl.innerHTML = `
          <div class="input-area">
            <div class="input-wrapper">
              <textarea class="input" data-el="input" rows="2" placeholder="Escribe un mensaje..." autocomplete="off"></textarea>
              <button class="send" data-el="send" aria-label="Enviar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <div class="powered">Powered by <a href="https://iagents.pro" target="_blank" rel="noopener">iAgents</a></div>
          </div>
        `;
        const input = footerEl.querySelector('[data-el="input"]');
        const sendBtn = footerEl.querySelector('[data-el="send"]');
        input.addEventListener("input", () => {
          input.style.height = "auto";
          input.style.height = Math.min(input.scrollHeight, 120) + "px";
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });
        sendBtn.addEventListener("click", sendMessage);
      }
    }

    function getInputEls() {
      return {
        input: footerEl.querySelector('[data-el="input"]'),
        sendBtn: footerEl.querySelector('[data-el="send"]'),
      };
    }

    // ---------- Render chat (messages) ----------
    function renderChat() {
      view = "chat";
      messagesEl.style.display = "flex";
      messagesEl.innerHTML = "";

      const session = getViewingSession();
      const msgs = session?.messages || [];

      // Show welcome if empty AND we're on the active session
      if (msgs.length === 0 && !isReadonly()) {
        appendTextDom("agent", WELCOME_MESSAGE);
      }

      msgs.forEach((m) => {
        if (m.kind === "link") {
          // Render link card from cache or refetch
          appendLinkDom(m.url);
        } else {
          appendTextDom(m.role, m.text);
        }
      });

      // Remove old history view if any
      const oldHist = body.querySelector(".history");
      if (oldHist) oldHist.remove();

      renderFooter();
      scrollToBottom();
    }

    // ---------- Render history list ----------
    function renderHistory() {
      view = "history";
      messagesEl.style.display = "none";
      footerEl.innerHTML = "";
      const oldHist = body.querySelector(".history");
      if (oldHist) oldHist.remove();

      const histEl = document.createElement("div");
      histEl.className = "history";

      const sorted = [...store.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

      if (sorted.length === 0) {
        histEl.innerHTML = `<div class="history-empty">No hay conversaciones aún.</div>`;
      } else {
        sorted.forEach((s) => {
          const card = document.createElement("button");
          card.className = "session-card" + (s.id === store.activeId ? " active" : "");
          card.innerHTML = `
            <div class="session-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="session-info">
              <div class="session-row">
                <span class="session-date">${escapeHtml(formatSessionDate(s.updatedAt || s.createdAt))}</span>
                ${s.id === store.activeId ? `<span class="session-badge">Actual</span>` : ""}
              </div>
              <div class="session-meta">${s.messages.length} mensaje${s.messages.length === 1 ? "" : "s"}</div>
            </div>
          `;
          card.addEventListener("click", () => {
            viewingSessionId = s.id;
            renderChat();
          });
          histEl.appendChild(card);
        });
      }

      body.insertBefore(histEl, footerEl);
    }

    // ---------- DOM helpers ----------
    function appendRow(role) {
      const row = document.createElement("div");
      row.className = "row " + role;
      messagesEl.appendChild(row);
      return row;
    }

    function appendTextDom(role, text) {
      const row = appendRow(role);
      const msg = document.createElement("div");
      msg.className = "msg " + role;
      msg.textContent = text;
      row.appendChild(msg);
    }

    function buildLinkCard(preview) {
      const card = document.createElement("a");
      card.className = "link-card";
      card.href = preview.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      const hasImage = !!preview.image;
      const imgPart = hasImage
        ? `<img class="link-card-img" src="${escapeHtml(preview.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'link-card-img-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\'></path><path d=\\'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\'></path></svg></div>'" />`
        : `<div class="link-card-img-placeholder">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
               <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
             </svg>
           </div>`;

      const siteRow = preview.favicon
        ? `<p class="link-card-site"><img src="${escapeHtml(preview.favicon)}" alt="" onerror="this.style.display='none'" />${escapeHtml(preview.siteName || "")}</p>`
        : `<p class="link-card-site">${escapeHtml(preview.siteName || "")}</p>`;

      card.innerHTML = `
        ${imgPart}
        <div class="link-card-body">
          ${siteRow}
          <p class="link-card-title">${escapeHtml(preview.title || preview.url)}</p>
          ${preview.description ? `<p class="link-card-desc">${escapeHtml(preview.description)}</p>` : ""}
        </div>
      `;
      return card;
    }

    function buildSkeleton() {
      const sk = document.createElement("div");
      sk.className = "link-card-skeleton";
      sk.innerHTML = `
        <div class="skel-img"></div>
        <div class="skel-line short"></div>
        <div class="skel-line"></div>
        <div class="skel-line" style="margin-bottom:14px;"></div>
      `;
      return sk;
    }

    async function appendLinkDom(url) {
      const row = appendRow("agent");
      const skeleton = buildSkeleton();
      row.appendChild(skeleton);
      const preview = await fetchOgPreview(url);
      if (!preview) {
        skeleton.remove();
        return;
      }
      const card = buildLinkCard(preview);
      row.replaceChild(card, skeleton);
      scrollToBottom();
    }

    function showTyping() {
      isTyping = true;
      const row = appendRow("agent");
      row.dataset.typing = "true";
      const dots = document.createElement("div");
      dots.className = "typing";
      dots.innerHTML = "<span></span><span></span><span></span>";
      row.appendChild(dots);
      scrollToBottom();
    }

    function hideTyping() {
      isTyping = false;
      const el = messagesEl.querySelector('[data-typing="true"]');
      if (el) el.remove();
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ---------- Persistence helpers ----------
    function pushToActive(entry) {
      const session = getActiveSession();
      if (!session) return;
      session.messages.push(entry);
      session.updatedAt = Date.now();
      saveStore(store);
    }

    // ---------- Actions ----------
    function toggleChat() {
      isOpen = !isOpen;
      chatWindow.classList.toggle("open", isOpen);
      bubble.classList.toggle("open", isOpen);
      bubble.setAttribute("aria-label", isOpen ? "Cerrar chat" : "Abrir chat");
      if (isOpen) {
        // Always return to active session when opening
        viewingSessionId = store.activeId;
        renderChat();
        setTimeout(() => {
          const { input } = getInputEls();
          input?.focus();
        }, 250);
      }
    }

    function startNewConversation() {
      const active = getActiveSession();
      // If active is empty (no messages), reuse it instead of creating empty sessions
      if (active && active.messages.length === 0) {
        viewingSessionId = active.id;
        renderChat();
        return;
      }
      const id = newSessionId();
      store.sessions.push({ id, createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
      store.activeId = id;
      viewingSessionId = id;
      saveStore(store);
      renderChat();
      setTimeout(() => {
        const { input } = getInputEls();
        input?.focus();
      }, 100);
    }

    async function sendMessage() {
      const { input, sendBtn } = getInputEls();
      if (!input || !sendBtn) return;
      const text = input.value.trim();
      if (!text || isTyping) return;
      if (isReadonly()) return;

      // Append user message
      pushToActive({ kind: "text", role: "user", text, ts: Date.now() });
      appendTextDom("user", text);
      scrollToBottom();
      input.value = "";
      input.style.height = "auto";
      sendBtn.disabled = true;
      showTyping();

      try {
        const res = await fetch(`${WEBHOOK_BASE_URL}/${AGENT_ID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            userId: `widget-visitor-${store.activeId}`,
            sessionId: store.activeId,
            timestamp: new Date().toISOString(),
            agent_id: AGENT_ID,
            source: SOURCE,
            channel: CHANNEL,
          }),
        });

        hideTyping();

        if (!res.ok) throw new Error("Request failed");

        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const reply = (await res.text()) || "Mensaje recibido.";
          data = { output: reply };
        }
        await handleAgentResponse(data);
      } catch (err) {
        hideTyping();
        const msg = "Lo siento, ocurrió un problema. Inténtalo de nuevo.";
        pushToActive({ kind: "text", role: "agent", text: msg, ts: Date.now() });
        appendTextDom("agent", msg);
        scrollToBottom();
        console.error("[iAgents Widget]", err);
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }

    async function handleAgentResponse(data) {
      const text =
        (data && (data.output || data.response || data.message || data.text)) || "";

      if (text) {
        pushToActive({ kind: "text", role: "agent", text, ts: Date.now() });
        appendTextDom("agent", text);
        scrollToBottom();
      }

      if (data && typeof data.link === "string" && data.link) {
        pushToActive({ kind: "link", role: "agent", url: data.link, ts: Date.now() });
        await appendLinkDom(data.link);
      }

      if (data && Array.isArray(data.links)) {
        for (const link of data.links) {
          if (typeof link === "string" && link) {
            pushToActive({ kind: "link", role: "agent", url: link, ts: Date.now() });
            await appendLinkDom(link);
          }
        }
      }

      if (!text && !data?.link && !(data?.links?.length)) {
        const fallback = "Mensaje recibido.";
        pushToActive({ kind: "text", role: "agent", text: fallback, ts: Date.now() });
        appendTextDom("agent", fallback);
        scrollToBottom();
      }
    }

    // ---------- Wire up ----------
    bubble.addEventListener("click", toggleChat);
    closeBtn.addEventListener("click", toggleChat);
    newBtn.addEventListener("click", startNewConversation);
    historyBtn.addEventListener("click", () => {
      if (view === "history") {
        renderChat();
      } else {
        renderHistory();
      }
    });

    // Initial render (chat is hidden until opened, but prepare DOM)
    renderChat();

    console.log("[iAgents] Widget loaded for agent:", AGENT_ID, "sessions:", store.sessions.length);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
