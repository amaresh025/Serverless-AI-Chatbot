/**
 * Professional Serverless Chatbot Client
 * Handles Multi-session History, Local Persistence, and AWS Lambda API Integration
 */

const CONFIG = {
  ENDPOINT: "https://zronibftd2.execute-api.ap-south-1.amazonaws.com/prod/serverless-chatbot",
  DEFAULT_TITLE: "New Conversation",
  STORAGE_KEY: "chatbot_sessions_v1",
  THEME_KEY: "chatbot_theme_pref",
  SUGGESTIONS: [
    "Explain how AWS Lambda works in simple terms",
    "Write a Python function to find prime numbers",
    "What is the difference between SQL and NoSQL?",
    "How does Gemini API process multimodal data?"
  ]
};

// Application State
let sessions = [];
let activeSessionId = null;
let isBusy = false;

// DOM Elements
const elements = {
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebarSessions: document.getElementById("sidebarSessions"),
  btnNewChat: document.getElementById("btnNewChat"),
  btnClearAll: document.getElementById("btnClearAll"),
  btnThemeToggle: document.getElementById("btnThemeToggle"),
  chatLog: document.getElementById("chatLog"),
  activeSessionTitle: document.getElementById("activeSessionTitle"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  composerForm: document.getElementById("composerForm"),
  inputField: document.getElementById("inputField"),
  btnSend: document.getElementById("btnSend")
};

// Utilities
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatMarkdown(source) {
  const codeBlocks = [];
  let formatted = escapeHtml(source).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code.replace(/\n$/, ""));
    return `\u0000${codeBlocks.length - 1}\u0000`;
  });

  formatted = formatted
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");

  return formatted.replace(/\u0000(\d+)\u0000/g, (_, index) => {
    return `<pre><code>${codeBlocks[index]}</code></pre>`;
  });
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function scrollToBottom() {
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function setBusy(busy) {
  isBusy = busy;
  elements.btnSend.disabled = busy;
  elements.statusDot.classList.toggle("busy", busy);
  elements.statusText.textContent = busy ? "Processing…" : "Online";
}

// Session Management
function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    sessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    sessions = [];
  }

  if (sessions.length === 0) {
    createNewSession(false);
  } else {
    activeSessionId = sessions[0].id;
    renderSidebar();
    renderActiveSessionMessages();
  }
}

function saveSessionsToStorage() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Storage save failed:", e);
  }
}

function getActiveSession() {
  return sessions.find(s => s.id === activeSessionId);
}

function createNewSession(switchImmediately = true) {
  const newSession = {
    id: "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
    title: CONFIG.DEFAULT_TITLE,
    createdAt: Date.now(),
    messages: []
  };

  sessions.unshift(newSession);
  saveSessionsToStorage();

  if (switchImmediately) {
    activeSessionId = newSession.id;
    renderSidebar();
    renderActiveSessionMessages();
    closeMobileSidebar();
  }
}

function switchSession(sessionId) {
  if (isBusy || activeSessionId === sessionId) return;
  activeSessionId = sessionId;
  renderSidebar();
  renderActiveSessionMessages();
  closeMobileSidebar();
}

function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();
  if (isBusy) return;

  sessions = sessions.filter(s => s.id !== sessionId);

  if (sessions.length === 0) {
    createNewSession(true);
  } else {
    if (activeSessionId === sessionId) {
      activeSessionId = sessions[0].id;
    }
    saveSessionsToStorage();
    renderSidebar();
    renderActiveSessionMessages();
  }
}

function clearAllSessions() {
  if (isBusy) return;
  if (confirm("Are you sure you want to delete all chat history?")) {
    sessions = [];
    createNewSession(true);
  }
}

// UI Rendering
function renderSidebar() {
  elements.sidebarSessions.innerHTML = "";

  if (sessions.length === 0) return;

  const label = document.createElement("div");
  label.className = "section-label";
  label.textContent = "Chat History (" + sessions.length + ")";
  elements.sidebarSessions.appendChild(label);

  sessions.forEach(session => {
    const item = document.createElement("div");
    item.className = "session-item" + (session.id === activeSessionId ? " active" : "");
    item.onclick = () => switchSession(session.id);

    const titleSpan = document.createElement("span");
    titleSpan.className = "session-name";
    titleSpan.textContent = session.title;

    const delBtn = document.createElement("button");
    delBtn.className = "session-delete-btn";
    delBtn.title = "Delete chat";
    delBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
      </svg>
    `;
    delBtn.onclick = (e) => deleteSession(session.id, e);

    item.appendChild(titleSpan);
    item.appendChild(delBtn);
    elements.sidebarSessions.appendChild(item);
  });
}

function renderEmptyState() {
  elements.chatLog.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  wrap.innerHTML = `
    <div class="empty-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>
    <h2>How can I help you today?</h2>
    <p>Ask a question or select a prompt below to interact with your serverless assistant.</p>
    <div class="suggestions-grid"></div>
  `;

  const grid = wrap.querySelector(".suggestions-grid");
  CONFIG.SUGGESTIONS.forEach(text => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "suggestion-card";
    card.textContent = text;
    card.onclick = () => handleSend(text);
    grid.appendChild(card);
  });

  elements.chatLog.appendChild(wrap);
}

function renderActiveSessionMessages() {
  elements.chatLog.innerHTML = "";
  const current = getActiveSession();

  if (!current) return;

  elements.activeSessionTitle.textContent = current.title;

  if (current.messages.length === 0) {
    renderEmptyState();
    return;
  }

  current.messages.forEach(msg => {
    appendMessageToLog(msg.role, msg.content, { time: msg.time });
  });

  scrollToBottom();
}

function appendMessageToLog(role, content, opts = {}) {
  const empty = elements.chatLog.querySelector(".empty-state");
  if (empty) empty.remove();

  const row = document.createElement("div");
  row.className = "msg-row " + (role === "user" ? "user" : "bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble" + (opts.error ? " error" : "");

  if (opts.typing) {
    bubble.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  } else {
    bubble.innerHTML = formatMarkdown(content);
  }

  if (role === "user") {
    row.appendChild(bubble);
  } else {
    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
      </svg>
    `;
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(col);
  }

  if (!opts.typing) {
    const timeEl = document.createElement("span");
    timeEl.className = "msg-time";
    timeEl.textContent = opts.time || getCurrentTime();
    if (role === "user") {
      row.appendChild(timeEl);
    } else {
      row.querySelector("div:last-child").appendChild(timeEl);
    }
  }

  elements.chatLog.appendChild(row);
  scrollToBottom();
  return bubble;
}

// Send Message Handler
async function handleSend(customText) {
  const text = (customText || elements.inputField.value).trim();
  if (!text || isBusy) return;

  const current = getActiveSession();
  if (!current) return;

  // Clear input and reset height
  elements.inputField.value = "";
  autoResizeInput();

  const msgTime = getCurrentTime();

  // Add User Message to State
  current.messages.push({ role: "user", content: text, time: msgTime });

  // Update session title on first message
  if (current.messages.length === 1 || current.title === CONFIG.DEFAULT_TITLE) {
    current.title = text.length > 28 ? text.slice(0, 28) + "…" : text;
    elements.activeSessionTitle.textContent = current.title;
    renderSidebar();
  }

  saveSessionsToStorage();
  appendMessageToLog("user", text, { time: msgTime });

  // Add Typing Bubble
  const typingBubble = appendMessageToLog("bot", "", { typing: true });
  setBusy(true);

  try {
    // API Call to Serverless Lambda
    const response = await fetch(CONFIG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.reply || data.message || (typeof data === "string" ? data : JSON.stringify(data));

    if (!replyText || !replyText.trim()) {
      throw new Error("Empty response received from assistant.");
    }

    // Replace typing dots with formatted content
    typingBubble.innerHTML = formatMarkdown(replyText);

    const botTime = getCurrentTime();
    const timeEl = document.createElement("span");
    timeEl.className = "msg-time";
    timeEl.textContent = botTime;
    typingBubble.parentElement.appendChild(timeEl);

    // Save Bot Reply to State
    current.messages.push({ role: "assistant", content: replyText, time: botTime });
    saveSessionsToStorage();

  } catch (error) {
    typingBubble.className = "bubble error";
    typingBubble.textContent = "Error: " + (error.message || "Failed to communicate with the server.");
  } finally {
    setBusy(false);
    elements.inputField.focus();
    scrollToBottom();
  }
}

// Mobile Sidebar Controls
function toggleMobileSidebar() {
  elements.sidebar.classList.toggle("open");
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove("open");
}

// Theme Controls
function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY);
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(CONFIG.THEME_KEY, next);
}

// Textarea Auto-resize
function autoResizeInput() {
  elements.inputField.style.height = "auto";
  elements.inputField.style.height = Math.min(elements.inputField.scrollHeight, 160) + "px";
}

// Event Listeners
function bindEvents() {
  elements.btnNewChat.addEventListener("click", () => createNewSession(true));
  elements.btnClearAll.addEventListener("click", clearAllSessions);
  elements.btnThemeToggle.addEventListener("click", toggleTheme);

  if (elements.sidebarToggle) {
    elements.sidebarToggle.addEventListener("click", toggleMobileSidebar);
  }
  if (elements.sidebarBackdrop) {
    elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  }

  elements.inputField.addEventListener("input", autoResizeInput);
  elements.inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  elements.btnSend.addEventListener("click", () => handleSend());
}

// Application Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  bindEvents();
  loadSessionsFromStorage();
});
