import { z } from "zod";

const ElementSchema = z.object({
  element: z
    .string()
    .describe(
      "Human-readable element description (for permission). Must match the description shown in the page snapshot.",
    ),
  ref: z
    .string()
    .describe(
      "Exact aria ref from the snapshot (e.g. 'e42'). This is required and used to locate the element. Copy it directly from the snapshot output.",
    ),
});

// --- Core (original protocol) ---

export const NavigateTool = z.object({
  name: z.literal("browser_navigate"),
  description: z.literal("Navigate to a URL"),
  arguments: z.object({ url: z.string().describe("The URL to navigate to") }),
});

export const GoBackTool = z.object({
  name: z.literal("browser_go_back"),
  description: z.literal("Go back to the previous page"),
  arguments: z.object({}),
});

export const GoForwardTool = z.object({
  name: z.literal("browser_go_forward"),
  description: z.literal("Go forward to the next page"),
  arguments: z.object({}),
});

export const WaitTool = z.object({
  name: z.literal("browser_wait"),
  description: z.literal("Wait for a specified time in seconds"),
  arguments: z.object({ time: z.number().describe("Seconds to wait") }),
});

export const PressKeyTool = z.object({
  name: z.literal("browser_press_key"),
  description: z.literal("Press a key on the keyboard"),
  arguments: z.object({
    key: z.string().describe("Key name, e.g. 'Enter', 'Tab', 'a', 'ArrowLeft'"),
  }),
});

export const SnapshotTool = z.object({
  name: z.literal("browser_snapshot"),
  description: z.literal(
    "Capture accessibility snapshot. Returns refs like 'e42' — use these in click/type/hover calls.",
  ),
  arguments: z.object({}),
});

export const ClickTool = z.object({
  name: z.literal("browser_click"),
  description: z.literal(
    "Click an element. Use the exact ref from the latest snapshot.",
  ),
  arguments: ElementSchema,
});

export const HoverTool = z.object({
  name: z.literal("browser_hover"),
  description: z.literal("Hover over an element"),
  arguments: ElementSchema,
});

export const TypeTool = z.object({
  name: z.literal("browser_type"),
  description: z.literal(
    "Type text into an element. Use Control+a to select all first if replacing text.",
  ),
  arguments: ElementSchema.extend({
    text: z.string().describe("Text to type"),
    submit: z.boolean().describe("Press Enter after typing"),
  }),
});

export const SelectOptionTool = z.object({
  name: z.literal("browser_select_option"),
  description: z.literal("Select an option in a dropdown"),
  arguments: ElementSchema.extend({
    values: z.array(z.string()).describe("Values to select"),
  }),
});

export const DragTool = z.object({
  name: z.literal("browser_drag"),
  description: z.literal("Drag from one element to another"),
  arguments: z.object({
    startElement: z.string().describe("Source element description"),
    startRef: z.string().describe("Source element ref from snapshot"),
    endElement: z.string().describe("Target element description"),
    endRef: z.string().describe("Target element ref from snapshot"),
  }),
});

export const ScreenshotTool = z.object({
  name: z.literal("browser_screenshot"),
  description: z.literal("Take a screenshot of the current page"),
  arguments: z.object({}),
});

export const GetConsoleLogsTool = z.object({
  name: z.literal("browser_get_console_logs"),
  description: z.literal("Get browser console logs"),
  arguments: z.object({}),
});

// --- Extended tools ---

export const ScrollTool = z.object({
  name: z.literal("browser_scroll"),
  description: z.literal("Scroll the page"),
  arguments: z.object({
    direction: z.enum(["up", "down", "left", "right"]).describe("Direction"),
    amount: z.number().optional().describe("Pixels to scroll (default 500)"),
  }),
});

export const NewTabTool = z.object({
  name: z.literal("browser_new_tab"),
  description: z.literal("Open a new tab"),
  arguments: z.object({ url: z.string().optional().describe("URL to open") }),
});

export const ReloadTool = z.object({
  name: z.literal("browser_reload"),
  description: z.literal("Reload the current page"),
  arguments: z.object({
    hard: z.boolean().optional().describe("Bypass cache"),
  }),
});

export const ListTabsTool = z.object({
  name: z.literal("browser_list_tabs"),
  description: z.literal("List all open tabs"),
  arguments: z.object({}),
});

export const CloseTabTool = z.object({
  name: z.literal("browser_close_tab"),
  description: z.literal("Close a tab by ID"),
  arguments: z.object({ tabId: z.number().describe("Tab ID to close") }),
});

export const SwitchTabTool = z.object({
  name: z.literal("browser_switch_tab"),
  description: z.literal("Switch to a tab by ID"),
  arguments: z.object({ tabId: z.number().describe("Tab ID to activate") }),
});

export const FindTextTool = z.object({
  name: z.literal("browser_find_text"),
  description: z.literal("Search for text on the page"),
  arguments: z.object({ text: z.string().describe("Text to find") }),
});

export const ExecuteJsTool = z.object({
  name: z.literal("browser_execute_js"),
  description: z.literal("Execute JavaScript on the page"),
  arguments: z.object({ script: z.string().describe("JavaScript code") }),
});

export const GetLinksTool = z.object({
  name: z.literal("browser_get_links"),
  description: z.literal("Extract all links from the page"),
  arguments: z.object({
    filter: z.string().optional().describe("Filter by URL or text"),
  }),
});

export const GetElementsTool = z.object({
  name: z.literal("browser_get_elements"),
  description: z.literal("Query elements by CSS selector"),
  arguments: z.object({
    selector: z.string().describe("CSS selector"),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
});

export const ExtractTableTool = z.object({
  name: z.literal("browser_extract_table"),
  description: z.literal("Extract a table as structured JSON"),
  arguments: z.object({
    selector: z.string().optional().describe("Table CSS selector (default 'table')"),
  }),
});

export const ExtractMetaTool = z.object({
  name: z.literal("browser_extract_meta"),
  description: z.literal("Extract meta tags, OpenGraph, Twitter Cards"),
  arguments: z.object({}),
});

export const ExtractImagesTool = z.object({
  name: z.literal("browser_extract_images"),
  description: z.literal("Get all images with src, alt, dimensions"),
  arguments: z.object({}),
});

export const GetCookiesTool = z.object({
  name: z.literal("browser_get_cookies"),
  description: z.literal("Read cookies for a URL"),
  arguments: z.object({
    url: z.string().optional().describe("URL to get cookies for"),
  }),
});

export const SetCookiesTool = z.object({
  name: z.literal("browser_set_cookies"),
  description: z.literal("Set a cookie"),
  arguments: z.object({
    url: z.string().describe("URL"),
    name: z.string().describe("Cookie name"),
    value: z.string().describe("Cookie value"),
    domain: z.string().optional(),
    path: z.string().optional(),
    secure: z.boolean().optional(),
    httpOnly: z.boolean().optional(),
  }),
});

export const GetStorageTool = z.object({
  name: z.literal("browser_get_storage"),
  description: z.literal("Read localStorage or sessionStorage"),
  arguments: z.object({
    type: z.enum(["localStorage", "sessionStorage"]).describe("Storage type"),
    key: z.string().optional().describe("Specific key (omit for all)"),
  }),
});

export const SetStorageTool = z.object({
  name: z.literal("browser_set_storage"),
  description: z.literal("Write to localStorage or sessionStorage"),
  arguments: z.object({
    type: z.enum(["localStorage", "sessionStorage"]).describe("Storage type"),
    key: z.string().describe("Key"),
    value: z.string().describe("Value"),
  }),
});

export const WaitForTool = z.object({
  name: z.literal("browser_wait_for"),
  description: z.literal("Wait for a CSS selector to appear on page"),
  arguments: z.object({
    selector: z.string().describe("CSS selector to wait for"),
    timeout: z.number().optional().describe("Timeout in ms (default 10000)"),
  }),
});

export const HighlightTool = z.object({
  name: z.literal("browser_highlight"),
  description: z.literal("Highlight elements with colored outline"),
  arguments: z.object({
    selector: z.string().describe("CSS selector"),
    color: z.string().optional().describe("Outline color (default red)"),
  }),
});

export const ReadabilityTool = z.object({
  name: z.literal("browser_readability"),
  description: z.literal("Extract main article content (Reader Mode)"),
  arguments: z.object({}),
});

export const RightClickTool = z.object({
  name: z.literal("browser_right_click"),
  description: z.literal("Right-click an element"),
  arguments: ElementSchema,
});

export const DoubleClickTool = z.object({
  name: z.literal("browser_double_click"),
  description: z.literal("Double-click an element"),
  arguments: ElementSchema,
});

export const InjectCssTool = z.object({
  name: z.literal("browser_inject_css"),
  description: z.literal("Inject custom CSS into the page"),
  arguments: z.object({ css: z.string().describe("CSS to inject") }),
});

export const NetworkLogTool = z.object({
  name: z.literal("browser_network_log"),
  description: z.literal("Monitor fetch/XHR network requests"),
  arguments: z.object({
    action: z.enum(["start", "stop", "get"]).describe("Action"),
    filter: z.string().optional().describe("Filter by URL"),
  }),
});

export const ConsoleLogTool = z.object({
  name: z.literal("browser_console_log"),
  description: z.literal("Monitor console.log/warn/error"),
  arguments: z.object({
    action: z.enum(["start", "stop", "get"]).describe("Action"),
  }),
});

export const GetComputedStyleTool = z.object({
  name: z.literal("browser_get_computed_style"),
  description: z.literal("Read computed CSS properties of an element"),
  arguments: z.object({
    selector: z.string().describe("CSS selector"),
    properties: z.array(z.string()).optional().describe("Specific properties"),
  }),
});
