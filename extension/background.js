// Browser MCP Extended — Background Service Worker
// Connects to the local MCP server via WebSocket and executes browser commands.
// Protocol: receives { id, type, payload }, responds with { type: "messageResponse", payload: { requestId, result } }

const WS_PORT = 9009;
const DEFAULT_WS_URL = `ws://127.0.0.1:${WS_PORT}`;
const KEEPALIVE_INTERVAL_MS = 20000;
const RETRY_INTERVAL_MS = 5000;
const RETRY_BACKOFF_MAX_MS = 60000;

let ws = null;
let connected = false;
let keepaliveTimer = null;
let retryTimer = null;
let resolvedWsUrl = null;
let lastError = null;
let logs = [];
let autoConnect = false;
let currentRetryDelay = RETRY_INTERVAL_MS;
const MAX_LOGS = 50;
const BANNER_ID = "bmcp-agent-banner";
let bannerTabs = new Set();

function addLog(level, message) {
  const entry = { time: new Date().toISOString(), level, message };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  if (level === "error") console.error("[BrowserMCP]", message);
  else console.log("[BrowserMCP]", message);
}

// ============================================================
// Page Control Banner
// ============================================================

async function injectBanner(tabId) {
  if (!tabId) {
    try {
      const focusedWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
      const [activeTab] = await chrome.tabs.query({ active: true, windowId: focusedWindow.id });
      tabId = activeTab?.id;
    } catch {
      return;
    }
  }
  if (!tabId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => {
        let banner = document.getElementById(id);
        if (!banner) {
          banner = document.createElement("div");
          banner.id = id;
          banner.innerHTML = `
            <span style="font-weight:600;">Browser MCP</span>
            <span style="opacity:0.9;">— this page is being controlled by an agent</span>
          `;
          banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 2147483647;
            background: #1e3a8a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            padding: 8px 16px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            pointer-events: none;
            transition: transform 0.2s ease;
          `;
          if (document.body) {
            document.body.appendChild(banner);
            document.body.style.paddingTop =
              (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + 36 + "px";
          }
        }
      },
      args: [BANNER_ID],
    });
    bannerTabs.add(tabId);
    addLog("info", `Injected control banner on tab ${tabId}`);
  } catch (e) {
    addLog("error", `Banner injection failed on tab ${tabId}: ${e.message || String(e)}`);
  }
}

async function removeBanner(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => {
        const banner = document.getElementById(id);
        if (banner) {
          banner.remove();
          document.body.style.paddingTop =
            Math.max(0, (parseFloat(getComputedStyle(document.body).paddingTop) || 0) - 36) + "px";
        }
      },
      args: [BANNER_ID],
    });
  } catch {}
  bannerTabs.delete(tabId);
}

async function removeAllBanners() {
  await Promise.all(Array.from(bannerTabs).map(removeBanner));
  bannerTabs.clear();
}

async function resolveWsUrl() {
  if (resolvedWsUrl) return resolvedWsUrl;
  try {
    const resp = await fetch(chrome.runtime.getURL("ws-config.json"));
    if (resp.ok) {
      const cfg = await resp.json();
      if (cfg.wsUrl) { resolvedWsUrl = cfg.wsUrl; return resolvedWsUrl; }
    }
  } catch {}
  resolvedWsUrl = DEFAULT_WS_URL;
  return resolvedWsUrl;
}

// ============================================================
// Auto-connect state persistence
// ============================================================

async function loadAutoConnect() {
  try {
    const data = await chrome.storage.local.get("autoConnect");
    autoConnect = data.autoConnect === true;
  } catch {
    autoConnect = false;
  }
  return autoConnect;
}

async function saveAutoConnect(value) {
  autoConnect = value === true;
  try {
    await chrome.storage.local.set({ autoConnect: autoConnect });
  } catch (e) {
    addLog("error", "Failed to save autoConnect state: " + (e.message || String(e)));
  }
}

// ============================================================
// WebSocket Connection
// ============================================================

function scheduleReconnect() {
  stopReconnect();
  if (!autoConnect || connected) return;

  // Use setInterval for fast retry while the service worker is awake.
  // MV3 may suspend the worker; the chrome.alarms listener below acts as a wake-up backup.
  retryTimer = setInterval(() => {
    if (autoConnect && !connected) connect();
  }, currentRetryDelay);

  // Create a one-time alarm as a backup wake-up mechanism.
  // Chrome throttles alarms to at most once per minute, so this is a fallback.
  try {
    chrome.alarms.create("bmcp-reconnect", { delayInMinutes: Math.max(1, currentRetryDelay / 60000) });
  } catch {}
}

function stopReconnect() {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  try { chrome.alarms.clear("bmcp-reconnect"); } catch {}
}

function resetRetryDelay() {
  currentRetryDelay = RETRY_INTERVAL_MS;
}

function backoffRetryDelay() {
  currentRetryDelay = Math.min(currentRetryDelay * 1.5, RETRY_BACKOFF_MAX_MS);
}

async function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  if (!autoConnect) return;

  const url = await resolveWsUrl();
  addLog("info", `Connecting to ${url}...`);
  console.log("[BrowserMCP] Connecting to", url);
  lastError = null;

  try {
    ws = new WebSocket(url);
  } catch (e) {
    lastError = e.message || "Failed to create WebSocket";
    addLog("error", lastError);
    backoffRetryDelay();
    return;
  }

  ws.onerror = (event) => {
    lastError = `Connection failed to ${url}`;
    addLog("error", lastError);
  };

  ws.onopen = async () => {
    connected = true;
    lastError = null;
    resetRetryDelay();
    addLog("info", "Connected to MCP server");
    updateBadge(true);
    await injectBanner();
    startKeepalive();
    stopReconnect();
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && msg.type) {
        const response = await handleCommand(msg);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(response));
        }
      }
    } catch (e) {
      if (e?.message?.includes("null")) return;
      console.error("[BrowserMCP] Message error:", e);
    }
  };

  ws.onclose = () => {
    const wasConnected = connected;
    connected = false;
    ws = null;
    if (wasConnected) addLog("info", "Disconnected from MCP server");
    updateBadge(false);
    removeAllBanners();
    stopKeepalive();
    if (autoConnect) {
      backoffRetryDelay();
      scheduleReconnect();
    }
  };
}

async function disconnect() {
  stopReconnect();
  stopKeepalive();
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  connected = false;
  updateBadge(false);
  removeAllBanners();
  addLog("info", "Disconnected");
}

async function enableAutoConnect() {
  await saveAutoConnect(true);
  resetRetryDelay();
  connect();
}

async function disableAutoConnect() {
  await saveAutoConnect(false);
  await disconnect();
}

function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }, KEEPALIVE_INTERVAL_MS);
}

function stopKeepalive() {
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

function updateBadge(isConnected) {
  chrome.action.setBadgeText({ text: isConnected ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: isConnected ? "#22c55e" : "#ef4444" });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (connected && changeInfo.status === "complete" && bannerTabs.has(tabId) && isInjectableUrl(tab.url)) {
    await injectBanner(tabId);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "bmcp-reconnect" && autoConnect && !connected) {
    connect();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getStatus") {
    sendResponse({ connected, autoConnect, lastError, url: resolvedWsUrl || DEFAULT_WS_URL });
    return true;
  }
  if (msg.type === "setAutoConnect") {
    if (msg.value) enableAutoConnect();
    else disableAutoConnect();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "reconnect") {
    resolvedWsUrl = null; // re-read ws-config.json on reconnect
    if (autoConnect) {
      connect();
    } else {
      enableAutoConnect();
    }
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "disconnect") {
    disableAutoConnect();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "getLogs") {
    sendResponse({ logs });
    return true;
  }
  if (msg.type === "getResolvedUrl") {
    sendResponse({ url: resolvedWsUrl || DEFAULT_WS_URL });
    return true;
  }
});

// On startup, read the persisted autoConnect state. If enabled, start connecting.
loadAutoConnect().then((enabled) => {
  if (enabled) {
    resetRetryDelay();
    connect();
  } else {
    updateBadge(false);
  }
});

// ============================================================
// Helpers
// ============================================================

async function getTargetTab(tabId) {
  let tab;
  if (tabId != null) tab = await chrome.tabs.get(tabId);
  else {
    const focusedWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: focusedWindow.id });
    if (!activeTab) throw new Error("No active tab found in focused window");
    tab = activeTab;
  }
  if (connected && tab?.id) await injectBanner(tab.id);
  return tab;
}

function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error("Tab load timed out")); }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(); }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function isInjectableUrl(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function requireInjectable(tab) {
  if (!isInjectableUrl(tab.url)) throw new Error(`Cannot interact with restricted URL: ${tab.url}`);
}

async function injectAndRun(tabId, func, args = [], world = "ISOLATED") {
  const tab = await getTargetTab(tabId);
  requireInjectable(tab);
  const opts = { target: { tabId: tab.id }, func, args };
  if (world === "MAIN") opts.world = "MAIN";
  const results = await chrome.scripting.executeScript(opts);
  if (results[0]?.error) throw new Error(results[0].error.message || "Script execution failed");
  return results[0]?.result;
}

// ============================================================
// Command Dispatcher
// ============================================================

async function handleCommand(msg) {
  const { id, type, payload } = msg;
  const handler = handlers[type];
  if (!handler) return { type: "messageResponse", payload: { requestId: id, error: `Unknown command: ${type}` } };
  try {
    const result = await Promise.race([
      handler(payload || {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Command '${type}' timed out after 30s`)), 30_000)),
    ]);
    return { type: "messageResponse", payload: { requestId: id, result } };
  } catch (e) {
    return { type: "messageResponse", payload: { requestId: id, error: e.message || String(e) } };
  }
}

// ============================================================
// Handler Registry
// ============================================================

const handlers = {};

// --- CORE (original browsermcp protocol) ---

handlers.getUrl = async () => {
  const tab = await getTargetTab();
  return tab.url || "";
};

handlers.getTitle = async () => {
  const tab = await getTargetTab();
  return tab.title || "";
};

handlers.browser_navigate = async ({ url }) => {
  const tab = await chrome.tabs.create({ url, active: true });
  if (tab.status !== "complete") await waitForTabLoad(tab.id);
  await new Promise((r) => setTimeout(r, 500));
  if (connected && tab.id) await injectBanner(tab.id);
  return "OK";
};

handlers.browser_go_back = async () => {
  const tab = await getTargetTab();
  await chrome.tabs.goBack(tab.id);
  await new Promise((r) => setTimeout(r, 500));
  return "OK";
};

handlers.browser_go_forward = async () => {
  const tab = await getTargetTab();
  await chrome.tabs.goForward(tab.id);
  await new Promise((r) => setTimeout(r, 500));
  return "OK";
};

handlers.browser_wait = async ({ time }) => {
  await new Promise((r) => setTimeout(r, (time || 1) * 1000));
  return "OK";
};

handlers.browser_press_key = async ({ key }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k) => {
      const target = document.activeElement || document.body;
      const code = k.length === 1 ? "Key" + k.toUpperCase() : k;
      const opts = { key: k, code, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent("keydown", opts));
      target.dispatchEvent(new KeyboardEvent("keypress", opts));
      target.dispatchEvent(new KeyboardEvent("keyup", opts));
      if (k.length === 1 && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? start;
        target.value = target.value.slice(0, start) + k + target.value.slice(end);
        target.selectionStart = target.selectionEnd = start + 1;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    },
    args: [key],
  });
  return "OK";
};

handlers.browser_snapshot = async () => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      function getAriaRef(el, counter) {
        if (!el._bmcpRef) {
          el._bmcpRef = "e" + counter.value++;
        }
        return el._bmcpRef;
      }
      const counter = { value: 1 };
      const lines = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          const tag = el.tagName.toLowerCase();
          if (["script", "style", "noscript", "meta", "link"].includes(tag)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const ref = getAriaRef(el, counter);
          const role = el.getAttribute("role") || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const text = el.textContent?.trim().slice(0, 100) || "";
          let type = "";
          if (tag === "input" || tag === "textarea" || tag === "select") type = el.type || tag;
          const parts = [`ref=${ref}`];
          if (role) parts.push(`[role=${role}]`);
          else if (tag === "a") parts.push("[link]");
          else if (tag === "button" || tag === "input" && type === "button" || tag === "input" && type === "submit") parts.push("[button]");
          else if (tag === "input" || tag === "textarea") parts.push(`[textbox]`);
          else if (tag === "select") parts.push("[combobox]");
          else if (tag === "img") parts.push("[image]");
          else if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") parts.push("[heading]");
          else if (tag === "li") parts.push("[listitem]");
          else if (tag === "ul" || tag === "ol") parts.push("[list]");
          if (ariaLabel) parts.push(`"${ariaLabel}"`);
          else if (text && text.length < 80) parts.push(`"${text}"`);
          lines.push(parts.join(" "));
        }
      };
      walk(document);
      return lines.join("\n");
    },
  });
  return results[0]?.result || "";
};

handlers.browser_click = async ({ ref, element }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.click();
          return true;
        }
      }
      // Fallback: try to find by text content
      const lower = refStr.toLowerCase();
      for (const el of all) {
        if (el.textContent?.trim().toLowerCase().includes(lower)) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.click();
          return true;
        }
      }
      throw new Error(`Element not found: ${refStr}`);
    },
    args: [ref || element],
  });
  return "OK";
};

handlers.browser_type = async ({ ref, element, text, submit }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr, txt, doSubmit) => {
      let target = null;
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr) { target = el; break; }
      }
      if (!target) {
        const lower = refStr.toLowerCase();
        for (const el of all) {
          if (el.textContent?.trim().toLowerCase().includes(lower) && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true")) {
            target = el;
            break;
          }
        }
      }
      if (!target) throw new Error(`Element not found: ${refStr}`);
      target.focus();
      const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
      if (nativeSetter) nativeSetter.call(target, txt);
      else target.value = txt;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      if (doSubmit) {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        target.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", bubbles: true }));
        target.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      }
      return true;
    },
    args: [ref || element, text, submit || false],
  });
  return "OK";
};

handlers.browser_hover = async ({ ref, element }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr) {
          el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
          el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
          return true;
        }
      }
      throw new Error(`Element not found: ${refStr}`);
    },
    args: [ref || element],
  });
  return "OK";
};

handlers.browser_select_option = async ({ ref, element, values }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr, vals) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr && el.tagName === "SELECT") {
          for (const opt of el.options) {
            if (vals.includes(opt.value) || vals.includes(opt.textContent?.trim())) {
              opt.selected = true;
            }
          }
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      throw new Error(`Select element not found: ${refStr}`);
    },
    args: [ref || element, values || []],
  });
  return "OK";
};

handlers.browser_drag = async ({ startRef, endRef }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (fromRef, toRef) => {
      let src = null, dst = null;
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === fromRef) src = el;
        if (el._bmcpRef === toRef) dst = el;
      }
      if (!src) throw new Error(`Drag source not found: ${fromRef}`);
      if (!dst) throw new Error(`Drop target not found: ${toRef}`);
      const dataTransfer = new DataTransfer();
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      dst.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
      dst.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
      return true;
    },
    args: [startRef, endRef],
  });
  return "OK";
};

handlers.browser_screenshot = async () => {
  const tab = await getTargetTab();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
};

handlers.browser_get_console_logs = async () => {
  return [];
};

// --- EXTENDED TOOLS ---

handlers.browser_scroll = async ({ direction, amount }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (dir, px) => {
      const map = { up: [0, -px], down: [0, px], left: [-px, 0], right: [px, 0] };
      const [x, y] = map[dir] || map.down;
      window.scrollBy(x, y);
      return { scrollX: Math.round(window.scrollX), scrollY: Math.round(window.scrollY) };
    },
    args: [direction || "down", amount || 500],
  });
  return "OK";
};

handlers.browser_new_tab = async ({ url }) => {
  const tab = await chrome.tabs.create({ url: url || "about:blank", active: true });
  if (connected && tab.id) await injectBanner(tab.id);
  return { tabId: tab.id, url: tab.url || url || "about:blank" };
};

handlers.browser_reload = async ({ hard }) => {
  const tab = await getTargetTab();
  await chrome.tabs.reload(tab.id, { bypassCache: hard || false });
  await waitForTabLoad(tab.id);
  return "OK";
};

handlers.browser_find_text = async ({ text }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (searchText) => {
      const results = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const lower = searchText.toLowerCase();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const content = node.textContent || "";
        const idx = content.toLowerCase().indexOf(lower);
        if (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(content.length, idx + searchText.length + 50);
          results.push({ match: content.slice(idx, idx + searchText.length), context: content.slice(start, end).trim(), element: node.parentElement?.tagName || "UNKNOWN" });
          if (results.length >= 50) break;
        }
      }
      return results;
    },
    args: [text],
  });
  return results[0]?.result || [];
};

handlers.browser_execute_js = async ({ script }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (jsCode) => (0, eval)(jsCode),
    args: [script],
    world: "MAIN",
  });
  return results[0]?.result;
};

handlers.browser_get_links = async ({ filter }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (f) => {
      const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: a.href, text: a.textContent?.trim().slice(0, 200) || "" }));
      if (!f) return links;
      const fl = f.toLowerCase();
      return links.filter((l) => l.href.toLowerCase().includes(fl) || l.text.toLowerCase().includes(fl));
    },
    args: [filter || null],
  });
  return results[0]?.result || [];
};

handlers.browser_get_elements = async ({ selector, limit }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, lim) => {
      const els = Array.from(document.querySelectorAll(sel)).slice(0, lim || 50);
      return els.map((el) => ({
        tagName: el.tagName,
        textContent: el.textContent?.trim().slice(0, 500) || "",
        href: el.href || "",
        src: el.src || "",
        alt: el.alt || "",
        value: el.value || "",
        class: el.className || "",
        id: el.id || "",
      }));
    },
    args: [selector, limit || 50],
  });
  return results[0]?.result || [];
};

handlers.browser_extract_table = async ({ selector }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel) => {
      const table = document.querySelector(sel);
      if (!table) throw new Error(`Table not found: ${sel}`);
      const headers = [];
      const headerRow = table.querySelector("thead tr") || table.querySelector("tr");
      if (headerRow) headerRow.querySelectorAll("th, td").forEach((c) => headers.push(c.textContent?.trim() || ""));
      const rows = [];
      const bodyRows = table.querySelectorAll("tbody tr");
      const dataRows = bodyRows.length ? bodyRows : table.querySelectorAll("tr");
      dataRows.forEach((tr, i) => {
        if (i === 0 && !table.querySelector("thead") && headers.length) return;
        const row = [];
        tr.querySelectorAll("td, th").forEach((c) => row.push(c.textContent?.trim() || ""));
        rows.push(row);
      });
      return { headers, rows };
    },
    args: [selector || "table"],
  });
  return results[0]?.result || { headers: [], rows: [] };
};

handlers.browser_extract_meta = async () => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const result = { title: document.title, canonical: "", meta: {}, openGraph: {}, twitter: {} };
      const canon = document.querySelector('link[rel="canonical"]');
      if (canon) result.canonical = canon.href;
      document.querySelectorAll("meta").forEach((m) => {
        const name = m.getAttribute("name");
        const prop = m.getAttribute("property");
        const content = m.getAttribute("content") || "";
        if (prop?.startsWith("og:")) result.openGraph[prop] = content;
        else if (name?.startsWith("twitter:") || prop?.startsWith("twitter:")) result.twitter[name || prop] = content;
        else if (name) result.meta[name] = content;
        else if (prop) result.meta[prop] = content;
      });
      return result;
    },
    args: [],
  });
  return results[0]?.result || {};
};

handlers.browser_extract_images = async () => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src, alt: img.alt || "", width: img.width, height: img.height,
      }));
    },
    args: [],
  });
  return results[0]?.result || [];
};

handlers.browser_get_cookies = async ({ url }) => {
  const tab = await getTargetTab();
  return await chrome.cookies.getAll({ url: url || tab.url });
};

handlers.browser_set_cookies = async ({ url, name, value, domain, path, secure, httpOnly, expirationDate }) => {
  const opts = { url, name, value, path: path || "/" };
  if (domain) opts.domain = domain;
  if (secure != null) opts.secure = secure;
  if (httpOnly != null) opts.httpOnly = httpOnly;
  if (expirationDate != null) opts.expirationDate = expirationDate;
  return await chrome.cookies.set(opts);
};

handlers.browser_get_storage = async ({ type, key }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (t, k) => {
      const storage = window[t];
      if (k) return { [k]: storage.getItem(k) };
      const all = {};
      for (let i = 0; i < storage.length; i++) { const sk = storage.key(i); all[sk] = storage.getItem(sk); }
      return all;
    },
    args: [type || "localStorage", key || null],
  });
  return results[0]?.result || {};
};

handlers.browser_set_storage = async ({ type, key, value }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (t, k, v) => { window[t].setItem(k, v); return true; },
    args: [type || "localStorage", key, value],
  });
  return "OK";
};

handlers.browser_wait_for = async ({ selector, timeout }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, tout) => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(sel);
        if (existing) return resolve({ found: true, tagName: existing.tagName, text: existing.textContent?.slice(0, 200) || "" });
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: "${sel}" not found within ${tout}ms`)); }, tout);
        const observer = new MutationObserver(() => {
          const el = document.querySelector(sel);
          if (el) { clearTimeout(timer); observer.disconnect(); resolve({ found: true, tagName: el.tagName, text: el.textContent?.slice(0, 200) || "" }); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    },
    args: [selector, timeout || 10000],
  });
  return results[0]?.result || {};
};

handlers.browser_highlight = async ({ selector, color }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, col) => {
      const els = document.querySelectorAll(sel);
      if (!els.length) throw new Error(`No elements found: ${sel}`);
      els.forEach((el) => { el.style.outline = `3px solid ${col}`; el.style.outlineOffset = "2px"; });
      return { count: els.length };
    },
    args: [selector, color || "red"],
  });
  return results[0]?.result || {};
};

handlers.browser_readability = async () => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const candidates = [
        document.querySelector("article"),
        document.querySelector('[role="main"]'),
        document.querySelector("main"),
        document.querySelector("#content"),
      ].filter(Boolean);
      let best = candidates[0];
      if (!best) {
        let maxLen = 0;
        document.querySelectorAll("div, section").forEach((el) => {
          const pText = Array.from(el.querySelectorAll("p")).reduce((sum, p) => sum + (p.textContent?.length || 0), 0);
          if (pText > maxLen) { maxLen = pText; best = el; }
        });
      }
      if (!best) best = document.body;
      const title = document.querySelector("h1")?.textContent?.trim() || document.title;
      const text = best.innerText || "";
      return { title, content: text, length: text.length, excerpt: text.slice(0, 300).trim() };
    },
    args: [],
  });
  return results[0]?.result || {};
};

handlers.browser_list_tabs = async () => {
  const tabs = await chrome.tabs.query({});
  return tabs.map((t) => ({ id: t.id, url: t.url || "", title: t.title || "", active: t.active || false }));
};

handlers.browser_close_tab = async ({ tabId }) => {
  await chrome.tabs.remove(tabId);
  return "OK";
};

handlers.browser_switch_tab = async ({ tabId }) => {
  const tab = await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  if (connected && tab.id) await injectBanner(tab.id);
  return { tabId: tab.id, title: tab.title, url: tab.url };
};

handlers.browser_right_click = async ({ ref, element }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr) {
          el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
          return true;
        }
      }
      throw new Error(`Element not found: ${refStr}`);
    },
    args: [ref || element],
  });
  return "OK";
};

handlers.browser_double_click = async ({ ref, element }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (refStr) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el._bmcpRef === refStr) {
          el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
          return true;
        }
      }
      throw new Error(`Element not found: ${refStr}`);
    },
    args: [ref || element],
  });
  return "OK";
};

handlers.browser_inject_css = async ({ css }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, css });
  return "OK";
};

handlers.browser_network_log = async ({ action, filter }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (act, filt) => {
      if (act === "start") {
        if (window.__bmcpNetLog) return { status: "already_running" };
        window.__bmcpNetLog = [];
        const origFetch = window.fetch;
        window.__bmcpOrigFetch = origFetch;
        window.fetch = async function (...args) {
          const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
          const method = args[1]?.method || "GET";
          const start = Date.now();
          try {
            const resp = await origFetch.apply(this, args);
            window.__bmcpNetLog.push({ url, method, status: resp.status, type: "fetch", duration: Date.now() - start, timestamp: start });
            if (window.__bmcpNetLog.length > 1000) window.__bmcpNetLog.shift();
            return resp;
          } catch (e) {
            window.__bmcpNetLog.push({ url, method, status: 0, type: "fetch", error: e.message, duration: Date.now() - start, timestamp: start });
            throw e;
          }
        };
        return { status: "started" };
      }
      if (act === "stop") {
        if (window.__bmcpOrigFetch) { window.fetch = window.__bmcpOrigFetch; delete window.__bmcpOrigFetch; }
        const log = window.__bmcpNetLog || [];
        delete window.__bmcpNetLog;
        return { status: "stopped", entries: log.length };
      }
      const log = window.__bmcpNetLog || [];
      if (!filt) return log;
      return log.filter((e) => e.url.includes(filt));
    },
    args: [action, filter || null],
    world: "MAIN",
  });
  return results[0]?.result || [];
};

handlers.browser_console_log = async ({ action }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (act) => {
      if (act === "start") {
        if (window.__bmcpConsoleLog) return { status: "already_running" };
        window.__bmcpConsoleLog = [];
        const levels = ["log", "warn", "error", "info", "debug"];
        window.__bmcpOrigConsole = {};
        for (const lvl of levels) {
          window.__bmcpOrigConsole[lvl] = console[lvl];
          console[lvl] = function (...args) {
            window.__bmcpConsoleLog.push({ level: lvl, args: args.map((a) => { try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); } }), timestamp: Date.now() });
            if (window.__bmcpConsoleLog.length > 1000) window.__bmcpConsoleLog.shift();
            window.__bmcpOrigConsole[lvl].apply(console, args);
          };
        }
        return { status: "started" };
      }
      if (act === "stop") {
        if (window.__bmcpOrigConsole) {
          for (const [lvl, fn] of Object.entries(window.__bmcpOrigConsole)) console[lvl] = fn;
          delete window.__bmcpOrigConsole;
        }
        const log = window.__bmcpConsoleLog || [];
        delete window.__bmcpConsoleLog;
        return { status: "stopped", entries: log.length };
      }
      return window.__bmcpConsoleLog || [];
    },
    args: [action],
    world: "MAIN",
  });
  return results[0]?.result || [];
};

handlers.browser_get_computed_style = async ({ selector, properties }) => {
  const tab = await getTargetTab();
  requireInjectable(tab);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, props) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found: ${sel}`);
      const cs = getComputedStyle(el);
      if (props && props.length) {
        const result = {};
        for (const p of props) result[p] = cs.getPropertyValue(p);
        return result;
      }
      const common = ["color", "background-color", "font-size", "font-family", "font-weight", "width", "height", "margin", "padding", "display", "position", "border", "opacity"];
      const result = {};
      for (const p of common) result[p] = cs.getPropertyValue(p);
      return result;
    },
    args: [selector, properties || null],
  });
  return results[0]?.result || {};
};

// ============================================================
// Initialize
// ============================================================

updateBadge(false);
