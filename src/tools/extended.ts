import { zodToJsonSchema } from "zod-to-json-schema";

import {
  CloseTabTool,
  ConsoleLogTool,
  DoubleClickTool,
  ExecuteJsTool,
  ExtractImagesTool,
  ExtractMetaTool,
  ExtractTableTool,
  FindTextTool,
  GetComputedStyleTool,
  GetCookiesTool,
  GetElementsTool,
  GetLinksTool,
  GetStorageTool,
  HighlightTool,
  InjectCssTool,
  ListTabsTool,
  NetworkLogTool,
  NewTabTool,
  ReadabilityTool,
  ReloadTool,
  RightClickTool,
  ScrollTool,
  SetCookiesTool,
  SetStorageTool,
  SwitchTabTool,
  WaitForTool,
} from "@/lib/types/tool";

import { captureAriaSnapshot } from "@/utils/aria-snapshot";

import type { Tool } from "./tool";

export const scroll: Tool = {
  schema: {
    name: ScrollTool.shape.name.value,
    description: ScrollTool.shape.description.value,
    inputSchema: zodToJsonSchema(ScrollTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { direction, amount } = ScrollTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_scroll", { direction, amount });
    return { content: [{ type: "text", text: `Scrolled ${direction}` }] };
  },
};

export const newTab: Tool = {
  schema: {
    name: NewTabTool.shape.name.value,
    description: NewTabTool.shape.description.value,
    inputSchema: zodToJsonSchema(NewTabTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { url } = NewTabTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_new_tab", { url });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
};

export const reload: Tool = {
  schema: {
    name: ReloadTool.shape.name.value,
    description: ReloadTool.shape.description.value,
    inputSchema: zodToJsonSchema(ReloadTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { hard } = ReloadTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_reload", { hard });
    return { content: [{ type: "text", text: "Page reloaded" }] };
  },
};

export const listTabs: Tool = {
  schema: {
    name: ListTabsTool.shape.name.value,
    description: ListTabsTool.shape.description.value,
    inputSchema: zodToJsonSchema(ListTabsTool.shape.arguments),
  },
  handle: async (context) => {
    const tabs = await context.sendSocketMessage("browser_list_tabs", {});
    return { content: [{ type: "text", text: JSON.stringify(tabs, null, 2) }] };
  },
};

export const closeTab: Tool = {
  schema: {
    name: CloseTabTool.shape.name.value,
    description: CloseTabTool.shape.description.value,
    inputSchema: zodToJsonSchema(CloseTabTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { tabId } = CloseTabTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_close_tab", { tabId });
    return { content: [{ type: "text", text: `Tab ${tabId} closed` }] };
  },
};

export const switchTab: Tool = {
  schema: {
    name: SwitchTabTool.shape.name.value,
    description: SwitchTabTool.shape.description.value,
    inputSchema: zodToJsonSchema(SwitchTabTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { tabId } = SwitchTabTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_switch_tab", { tabId });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
};

export const findText: Tool = {
  schema: {
    name: FindTextTool.shape.name.value,
    description: FindTextTool.shape.description.value,
    inputSchema: zodToJsonSchema(FindTextTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { text } = FindTextTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_find_text", { text });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const executeJs: Tool = {
  schema: {
    name: ExecuteJsTool.shape.name.value,
    description: ExecuteJsTool.shape.description.value,
    inputSchema: zodToJsonSchema(ExecuteJsTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { script } = ExecuteJsTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_execute_js", { script });
    return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result) }] };
  },
};

export const getLinks: Tool = {
  schema: {
    name: GetLinksTool.shape.name.value,
    description: GetLinksTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetLinksTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { filter } = GetLinksTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_get_links", { filter });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const getElements: Tool = {
  schema: {
    name: GetElementsTool.shape.name.value,
    description: GetElementsTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetElementsTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { selector, limit } = GetElementsTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_get_elements", { selector, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const extractTable: Tool = {
  schema: {
    name: ExtractTableTool.shape.name.value,
    description: ExtractTableTool.shape.description.value,
    inputSchema: zodToJsonSchema(ExtractTableTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { selector } = ExtractTableTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_extract_table", { selector });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const extractMeta: Tool = {
  schema: {
    name: ExtractMetaTool.shape.name.value,
    description: ExtractMetaTool.shape.description.value,
    inputSchema: zodToJsonSchema(ExtractMetaTool.shape.arguments),
  },
  handle: async (context) => {
    const result = await context.sendSocketMessage("browser_extract_meta", {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const extractImages: Tool = {
  schema: {
    name: ExtractImagesTool.shape.name.value,
    description: ExtractImagesTool.shape.description.value,
    inputSchema: zodToJsonSchema(ExtractImagesTool.shape.arguments),
  },
  handle: async (context) => {
    const result = await context.sendSocketMessage("browser_extract_images", {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const getCookies: Tool = {
  schema: {
    name: GetCookiesTool.shape.name.value,
    description: GetCookiesTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetCookiesTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { url } = GetCookiesTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_get_cookies", { url });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const setCookies: Tool = {
  schema: {
    name: SetCookiesTool.shape.name.value,
    description: SetCookiesTool.shape.description.value,
    inputSchema: zodToJsonSchema(SetCookiesTool.shape.arguments),
  },
  handle: async (context, params) => {
    const args = SetCookiesTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_set_cookies", args);
    return { content: [{ type: "text", text: "Cookie set" }] };
  },
};

export const getStorage: Tool = {
  schema: {
    name: GetStorageTool.shape.name.value,
    description: GetStorageTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetStorageTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { type, key } = GetStorageTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_get_storage", { type, key });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const setStorage: Tool = {
  schema: {
    name: SetStorageTool.shape.name.value,
    description: SetStorageTool.shape.description.value,
    inputSchema: zodToJsonSchema(SetStorageTool.shape.arguments),
  },
  handle: async (context, params) => {
    const args = SetStorageTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_set_storage", args);
    return { content: [{ type: "text", text: "Storage set" }] };
  },
};

export const waitFor: Tool = {
  schema: {
    name: WaitForTool.shape.name.value,
    description: WaitForTool.shape.description.value,
    inputSchema: zodToJsonSchema(WaitForTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { selector, timeout } = WaitForTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_wait_for", { selector, timeout });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
};

export const highlight: Tool = {
  schema: {
    name: HighlightTool.shape.name.value,
    description: HighlightTool.shape.description.value,
    inputSchema: zodToJsonSchema(HighlightTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { selector, color } = HighlightTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_highlight", { selector, color });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
};

export const readability: Tool = {
  schema: {
    name: ReadabilityTool.shape.name.value,
    description: ReadabilityTool.shape.description.value,
    inputSchema: zodToJsonSchema(ReadabilityTool.shape.arguments),
  },
  handle: async (context) => {
    const result = await context.sendSocketMessage("browser_readability", {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const rightClick: Tool = {
  schema: {
    name: RightClickTool.shape.name.value,
    description: RightClickTool.shape.description.value,
    inputSchema: zodToJsonSchema(RightClickTool.shape.arguments),
  },
  handle: async (context, params) => {
    const validated = RightClickTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_right_click", { ref: validated.ref, element: validated.element });
    return { content: [{ type: "text", text: `Right-clicked "${validated.element}"` }] };
  },
};

export const doubleClick: Tool = {
  schema: {
    name: DoubleClickTool.shape.name.value,
    description: DoubleClickTool.shape.description.value,
    inputSchema: zodToJsonSchema(DoubleClickTool.shape.arguments),
  },
  handle: async (context, params) => {
    const validated = DoubleClickTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_double_click", { ref: validated.ref, element: validated.element });
    return { content: [{ type: "text", text: `Double-clicked "${validated.element}"` }] };
  },
};

export const injectCss: Tool = {
  schema: {
    name: InjectCssTool.shape.name.value,
    description: InjectCssTool.shape.description.value,
    inputSchema: zodToJsonSchema(InjectCssTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { css } = InjectCssTool.shape.arguments.parse(params);
    await context.sendSocketMessage("browser_inject_css", { css });
    return { content: [{ type: "text", text: "CSS injected" }] };
  },
};

export const networkLog: Tool = {
  schema: {
    name: NetworkLogTool.shape.name.value,
    description: NetworkLogTool.shape.description.value,
    inputSchema: zodToJsonSchema(NetworkLogTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { action, filter } = NetworkLogTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_network_log", { action, filter });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const consoleLog: Tool = {
  schema: {
    name: ConsoleLogTool.shape.name.value,
    description: ConsoleLogTool.shape.description.value,
    inputSchema: zodToJsonSchema(ConsoleLogTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { action } = ConsoleLogTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_console_log", { action });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const getComputedStyle: Tool = {
  schema: {
    name: GetComputedStyleTool.shape.name.value,
    description: GetComputedStyleTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetComputedStyleTool.shape.arguments),
  },
  handle: async (context, params) => {
    const { selector, properties } = GetComputedStyleTool.shape.arguments.parse(params);
    const result = await context.sendSocketMessage("browser_get_computed_style", { selector, properties });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};
