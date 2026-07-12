chrome.runtime.sendMessage({ type: "getStatus" }, (res) => {
  const el = document.getElementById("status");
  if (res?.connected) {
    el.textContent = "Connected to MCP server";
    el.className = "status connected";
  } else {
    el.textContent = "Disconnected";
    el.className = "status disconnected";
  }
});

document.getElementById("reconnect").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reconnect" }, () => {
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "getStatus" }, (res) => {
        const el = document.getElementById("status");
        if (res?.connected) {
          el.textContent = "Connected to MCP server";
          el.className = "status connected";
        } else {
          el.textContent = "Disconnected";
          el.className = "status disconnected";
        }
      });
    }, 1000);
  });
});
