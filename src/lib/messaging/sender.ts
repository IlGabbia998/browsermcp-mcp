import type { WebSocket } from "ws";

const MESSAGE_RESPONSE_TYPE = "messageResponse";

export type SocketMessageMap = {
  // Core
  browser_navigate: { url: string };
  browser_go_back: {};
  browser_go_forward: {};
  browser_wait: { time: number };
  browser_press_key: { key: string };
  browser_snapshot: {};
  browser_click: { element: string; ref: string };
  browser_hover: { element: string; ref: string };
  browser_type: { element: string; ref: string; text: string; submit: boolean };
  browser_select_option: { element: string; ref: string; values: string[] };
  browser_drag: { startElement: string; startRef: string; endElement: string; endRef: string };
  browser_screenshot: {};
  browser_get_console_logs: {};
  getUrl: undefined;
  getTitle: undefined;
  // Extended
  browser_scroll: { direction: string; amount?: number };
  browser_new_tab: { url?: string };
  browser_reload: { hard?: boolean };
  browser_list_tabs: {};
  browser_close_tab: { tabId: number };
  browser_switch_tab: { tabId: number };
  browser_find_text: { text: string };
  browser_execute_js: { script: string };
  browser_get_links: { filter?: string };
  browser_get_elements: { selector: string; limit?: number };
  browser_extract_table: { selector?: string };
  browser_extract_meta: {};
  browser_extract_images: {};
  browser_get_cookies: { url?: string };
  browser_set_cookies: { url: string; name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean };
  browser_get_storage: { type: string; key?: string };
  browser_set_storage: { type: string; key: string; value: string };
  browser_wait_for: { selector: string; timeout?: number };
  browser_highlight: { selector: string; color?: string };
  browser_readability: {};
  browser_right_click: { element: string; ref: string };
  browser_double_click: { element: string; ref: string };
  browser_inject_css: { css: string };
  browser_network_log: { action: string; filter?: string };
  browser_console_log: { action: string };
  browser_get_computed_style: { selector: string; properties?: string[] };
};

export type MessageType<T> = keyof T;
export type MessagePayload<T, K> = K extends keyof T ? T[K] : never;

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}`;
}

export function createSocketMessageSender<T extends Record<string, any>>(
  ws: WebSocket,
) {
  async function sendSocketMessage(
    type: string,
    payload: any,
    options: { timeoutMs?: number } = { timeoutMs: 30000 },
  ): Promise<any> {
    const { timeoutMs } = options;
    const id = generateId();
    const message = { id, type, payload };

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let removed = false;

      const cleanup = () => {
        if (removed) return;
        removed = true;
        ws.removeEventListener("message", listener);
        ws.removeEventListener("error", errorHandler);
        ws.removeEventListener("close", closeHandler);
        clearTimeout(timeoutId);
      };

      const listener = (event: any) => {
        try {
          const raw =
            typeof event.data === "string" ? event.data : event.data?.toString();
          if (!raw) return;
          const responseMessage = JSON.parse(raw);
          if (responseMessage.type !== MESSAGE_RESPONSE_TYPE) return;

          const responsePayload = responseMessage.payload;
          if (responsePayload.requestId !== id) return;

          const { result, error } = responsePayload;
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }
          cleanup();
        } catch {
          // ignore non-JSON
        }
      };

      const errorHandler = () => {
        cleanup();
        reject(new Error("WebSocket error occurred"));
      };

      const closeHandler = () => {
        cleanup();
        reject(new Error("WebSocket closed"));
      };

      ws.addEventListener("message", listener);
      ws.addEventListener("error", errorHandler);
      ws.addEventListener("close", closeHandler);

      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(
            new Error(`WebSocket response timeout after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      }

      if (ws.readyState === (ws as any).OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        cleanup();
        reject(new Error("WebSocket is not open"));
      }
    });
  }

  return { sendSocketMessage };
}
