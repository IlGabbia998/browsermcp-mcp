function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res));
  });
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function updateUI() {
  const status = await sendMessage({ type: "getStatus" });
  const { connected, autoConnect, lastError, url } = status || {};

  const statusBar = document.getElementById("status-bar");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const toggle = document.getElementById("auto-connect-toggle");
  const toggleDesc = document.getElementById("toggle-desc");
  const badge = document.getElementById("badge");
  const errorBanner = document.getElementById("error-banner");
  const infoUrl = document.getElementById("info-url");

  toggle.checked = !!autoConnect;

  if (connected) {
    statusBar.className = "status-bar status-connected";
    statusDot.className = "status-dot dot-connected";
    statusText.innerHTML = "Connected<small>Receiving commands from MCP server</small>";
    toggleDesc.textContent = "Connected — will reconnect if dropped";
    badge.textContent = "ON";
    badge.className = "badge badge-on";
    errorBanner.className = "error-banner";
  } else if (autoConnect) {
    statusBar.className = "status-bar status-connecting";
    statusDot.className = "status-dot dot-connecting";
    statusText.innerHTML = "Trying to connect...<small>Auto-retry is enabled</small>";
    toggleDesc.textContent = "Trying to connect automatically";
    badge.textContent = "...";
    badge.className = "badge badge-off";
    if (lastError) {
      errorBanner.textContent = lastError;
      errorBanner.className = "error-banner visible";
    } else {
      errorBanner.className = "error-banner";
    }
  } else {
    statusBar.className = "status-bar status-disconnected";
    statusDot.className = "status-dot dot-disconnected";
    statusText.innerHTML = "Disconnected<small>Auto-connect is off</small>";
    toggleDesc.textContent = "Reconnect automatically";
    badge.textContent = "OFF";
    badge.className = "badge badge-off";
    if (lastError) {
      errorBanner.textContent = lastError;
      errorBanner.className = "error-banner visible";
    } else {
      errorBanner.className = "error-banner";
    }
  }

  infoUrl.textContent = url || "—";
}

async function updateLogs() {
  const res = await sendMessage({ type: "getLogs" });
  const container = document.getElementById("log-container");
  if (!res?.logs?.length) {
    container.innerHTML = '<div class="log-entry" style="color:#808080">No logs yet</div>';
    return;
  }
  container.innerHTML = res.logs.map((entry) => {
    const cls = entry.level === "error" ? "log-error" : "log-info";
    return `<div class="log-entry"><span class="log-time">${formatTime(entry.time)}</span> <span class="${cls}">${entry.message}</span></div>`;
  }).reverse().join("");
  container.scrollTop = 0;
}

document.getElementById("auto-connect-toggle").addEventListener("change", async (e) => {
  const value = e.target.checked;
  await sendMessage({ type: "setAutoConnect", value });
  updateUI();
});

document.getElementById("log-toggle").addEventListener("click", () => {
  const container = document.getElementById("log-container");
  const arrow = document.getElementById("log-arrow");
  container.classList.toggle("visible");
  arrow.classList.toggle("open");
  if (container.classList.contains("visible")) updateLogs();
});

updateUI();
updateLogs();
