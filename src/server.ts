import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Context } from "@/context";
import type { Resource } from "@/resources/resource";
import type { Tool } from "@/tools/tool";
import { createWebSocketServer } from "@/ws";

const CONNECTION_ERROR_PATTERNS = [
  /econnrefused/i,
  /connection refused/i,
  /failed to connect/i,
  /could not connect/i,
  /browser\s*mcp.*(?:disconnected|unavailable|not connected)/i,
  /extension.*(?:disabled|disconnected|not connected|unavailable)/i,
  /websocket.*(?:closed|failed)/i,
  /timed out/i,
  /no connection/i,
];

function isConnectionError(text: string): boolean {
  return CONNECTION_ERROR_PATTERNS.some((p) => p.test(text));
}

function appendSection(base: string, section: string): string {
  if (!base) return section;
  if (base.includes(section)) return base;
  return `${base.trimEnd()}\n\n${section}`;
}

type Options = {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[];
};

export async function createServerWithTools(options: Options): Promise<Server> {
  const { name, version, tools, resources } = options;
  const context = new Context();
  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const wss = await createWebSocketServer();
  wss.on("connection", (websocket, req) => {
    console.error(`[BrowserMCP] Extension connected from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    if (context.hasWs()) {
      console.error("[BrowserMCP] Closing previous extension connection");
      context.ws.close();
    }
    context.ws = websocket;

    websocket.on("message", (data) => {
      const raw = typeof data === "string" ? data : data.toString();
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "ping") {
          // Respond to client keepalive pings to keep the socket alive through proxies/firewalls.
          if (websocket.readyState === websocket.OPEN) {
            websocket.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }
        console.error(`[BrowserMCP] Message from extension: ${raw.substring(0, 200)}`);
      } catch {
        console.error(`[BrowserMCP] Raw message from extension: ${raw.substring(0, 200)}`);
      }
    });

    websocket.on("close", (code, reason) => {
      console.error(`[BrowserMCP] Extension disconnected (code=${code}, reason=${reason?.toString() || ""})`);
      if (context.ws === websocket) {
        context.ws = undefined;
      }
    });

    websocket.on("error", (err) => {
      console.error(`[BrowserMCP] Extension socket error: ${err.message}`);
    });
  });

  wss.on("error", (err) => {
    console.error(`[BrowserMCP] WebSocket server error: ${err.message}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((tool) => tool.schema) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map((resource) => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((tool) => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Tool "${request.params.name}" not found` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handle(context, request.params.arguments);

      // Detect connection errors and append retry guidance
      if (result.isError || result.content) {
        const textContent = result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");

        if (isConnectionError(textContent)) {
          const hint =
            "[Browser MCP] The browser connection looks unavailable. " +
            "Re-enable the Browser MCP extension or browser, then retry immediately. " +
            "No backoff needed — retry as soon as the extension is ready.";

          return {
            ...result,
            content: result.content.map((c: any) =>
              c.type === "text"
                ? { ...c, text: appendSection(c.text, hint) }
                : c,
            ),
            isError: true,
          };
        }
      }

      return result;
    } catch (error) {
      const errorText = String(error);
      if (isConnectionError(errorText)) {
        return {
          content: [
            {
              type: "text",
              text: appendSection(
                errorText,
                "[Browser MCP] The browser connection looks unavailable. " +
                  "Re-enable the Browser MCP extension or browser, then retry immediately.",
              ),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: errorText }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find(
      (resource) => resource.schema.uri === request.params.uri,
    );
    if (!resource) {
      return { contents: [] };
    }

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  const originalClose = server.close.bind(server);
  server.close = async () => {
    await originalClose();
    await wss.close();
    await context.close();
  };

  return server;
}
