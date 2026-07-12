<a href="https://browsermcp.io">
  <img src="./.github/images/banner.png" alt="Browser MCP banner">
</a>

<h3 align="center">Browser MCP</h3>

<p align="center">
  Automate your browser with AI.
  <br />
  <a href="https://browsermcp.io"><strong>Website</strong></a> 
  •
  <a href="https://docs.browsermcp.io"><strong>Docs</strong></a>
</p>

## About

Browser MCP is an MCP server + browser extension that allows you to automate your browser using AI applications like VS Code, Claude, Cursor, and Windsurf. Supports both **Chrome** and **Firefox**.

This is a fork of the [original Browser MCP](https://github.com/browsermcp/mcp) with the following changes:

- **Standalone build**: All monorepo dependencies (`@repo/*`, `@r2r/messaging`) replaced with local implementations
- **Extended toolset**: 39 tools (up from 12 core tools) including tab management, JavaScript execution, cookie/storage access, CSS injection, network monitoring, and more
- **Cross-browser extension**: Full-featured extension with all 36 command handlers, compatible with both Chrome (MV3) and Firefox (MV3)
- **WSL support**: Auto-detects WSL IP and writes a config file for the extension to discover the correct WebSocket address
- **Connection resilience**: Speed guidance in tool descriptions, connection error detection with retry hints

## Features

- ⚡ Fast: Automation happens locally on your machine, resulting in better performance without network latency.
- 🔒 Private: Since automation happens locally, your browser activity stays on your device and isn't sent to remote servers.
- 👤 Logged In: Uses your existing browser profile, keeping you logged into all your services.
- 🥷🏼 Stealth: Avoids basic bot detection and CAPTCHAs by using your real browser fingerprint.

## Installation

### Prerequisites

- Node.js >= 18
- Google Chrome, Chromium, or Firefox 113+
- The Browser MCP extension (included in `extension/`)

### From source

```bash
git clone https://github.com/IlGabbia998/browsermcp-mcp.git
cd browsermcp-mcp
npm install
npm run build
```

### Load the extension

#### Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder from this project
4. The extension will show in your toolbar — click it and hit **Reconnect** when the MCP server is running

#### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `extension/manifest.json` from this project
4. The extension will show in your toolbar — click it and hit **Reconnect** when the MCP server is running

> **Note:** Firefox temporary add-ons are removed when Firefox is restarted. To install permanently, the extension needs to be signed through [addons.mozilla.org](https://addons.mozilla.org).

### Using in your MCP client

Add the server to your MCP client config. The built entry point is `dist/index.js`.

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/absolute/path/to/browsermcp-mcp/dist/index.js"]
    }
  }
}
```

#### opencode

Add to your `opencode.json`:

```json
{
  "mcp": {
    "browser": {
      "type": "local",
      "command": ["node", "/absolute/path/to/browsermcp-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

#### Cursor / Windsurf

Add to your MCP settings (`.cursor/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/absolute/path/to/browsermcp-mcp/dist/index.js"]
    }
  }
}
```

### Connect the browser

1. Start the MCP server (via your MCP client or `node dist/index.js`)
2. Open Chrome/Firefox and click the Browser MCP extension icon in the toolbar
3. Click **Reconnect** — the extension auto-discovers the server address
4. The MCP server will detect the connection automatically

## Available Tools (39)

### Core

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_go_back` | Navigate back |
| `browser_go_forward` | Navigate forward |
| `browser_snapshot` | Capture an accessibility snapshot of the page |
| `browser_click` | Click an element (by ref or description) |
| `browser_hover` | Hover over an element |
| `browser_type` | Type text into an input field |
| `browser_select_option` | Select an option in a dropdown |
| `browser_drag` | Drag from one element to another |
| `browser_press_key` | Press a keyboard key |
| `browser_wait` | Wait for N seconds |
| `browser_screenshot` | Take a screenshot |
| `browser_get_console_logs` | Get browser console logs |

### Navigation & Tabs

| Tool | Description |
|------|-------------|
| `browser_scroll` | Scroll the page (up/down/left/right) |
| `browser_new_tab` | Open a new tab |
| `browser_reload` | Reload the current page |
| `browser_list_tabs` | List all open tabs |
| `browser_close_tab` | Close a tab by ID |
| `browser_switch_tab` | Switch to a tab by ID |

### Page Interaction

| Tool | Description |
|------|-------------|
| `browser_find_text` | Find text content on the page |
| `browser_execute_js` | Execute arbitrary JavaScript |
| `browser_get_links` | Extract all links from the page |
| `browser_get_elements` | Query elements by CSS selector |
| `browser_extract_table` | Extract table data as structured JSON |
| `browser_extract_meta` | Extract page metadata and OpenGraph tags |
| `browser_extract_images` | Extract all images from the page |
| `browser_right_click` | Right-click an element |
| `browser_double_click` | Double-click an element |
| `browser_highlight` | Highlight elements matching a selector |
| `browser_readability` | Extract main article content |
| `browser_wait_for` | Wait for an element to appear |
| `browser_get_computed_style` | Get computed CSS styles for an element |
| `browser_inject_css` | Inject custom CSS into the page |

### Storage & Cookies

| Tool | Description |
|------|-------------|
| `browser_get_cookies` | Get cookies for the current page |
| `browser_set_cookies` | Set a cookie |
| `browser_get_storage` | Read from localStorage or sessionStorage |
| `browser_set_storage` | Write to localStorage or sessionStorage |

### Monitoring

| Tool | Description |
|------|-------------|
| `browser_network_log` | Start/stop/query network request logging |
| `browser_console_log` | Start/stop/query console log interception |

## Usage examples

Ask your AI assistant to do things like:

- "Go to github.com and take a screenshot"
- "Click the login button and fill in my email"
- "Scroll down and click the next page link"
- "Extract all links from this page"
- "Show me the cookies for this site"
- "Run JavaScript to get the page title"
- "Monitor network requests while I navigate"
- "Inject a custom CSS theme on this page"

The AI uses accessibility snapshots to understand the page structure and interact with elements reliably.

## Contributing

This is a standalone build of the Browser MCP server, extracted from the original monorepo. All monorepo dependencies have been replaced with local implementations.

### Project structure

```
src/
  index.ts              # Entry point, tool registration
  server.ts             # MCP server with connection error handling
  context.ts            # WebSocket context management
  ws.ts                 # WebSocket server creation
  lib/
    config/             # App and MCP configuration
    messaging/          # WebSocket message sender
    types/              # Zod schemas for all tools
  tools/
    snapshot.ts         # Core interaction tools (click, type, hover, etc.)
    common.ts           # Navigation tools (navigate, goBack, etc.)
    custom.ts           # Screenshot, console logs
    extended.ts         # All extended tools (26 new tools)
    tool.ts             # Tool type definitions
  utils/
    port.ts             # Port utilities
    aria-snapshot.ts    # Accessibility snapshot capture
extension/
  background.js         # Cross-browser service worker (36 command handlers)
  manifest.json         # Extension manifest (MV3, Chrome + Firefox compatible)
  popup.html            # Extension popup UI
  popup.js              # Popup JavaScript
  icons/                # Extension icons
```

## Credits

Browser MCP was adapted from the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) in order to automate the user's browser rather than creating new browser instances. This allows using the user's existing browser profile to use logged-in sessions and avoid bot detection mechanisms that commonly block automated browser use.
