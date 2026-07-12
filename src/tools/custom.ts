import { zodToJsonSchema } from "zod-to-json-schema";

import { GetConsoleLogsTool, ScreenshotTool } from "@/lib/types/tool";

import type { Tool } from "./tool";

export const getConsoleLogs: Tool = {
  schema: {
    name: GetConsoleLogsTool.shape.name.value,
    description: GetConsoleLogsTool.shape.description.value,
    inputSchema: zodToJsonSchema(GetConsoleLogsTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const consoleLogs = await context.sendSocketMessage(
      "browser_get_console_logs",
      {},
    );
    const text: string = consoleLogs
      ? (Array.isArray(consoleLogs)
          ? consoleLogs.map((log: any) => JSON.stringify(log)).join("\n")
          : String(consoleLogs))
      : "No console logs";
    return {
      content: [{ type: "text", text }],
    };
  },
};

export const screenshot: Tool = {
  schema: {
    name: ScreenshotTool.shape.name.value,
    description: ScreenshotTool.shape.description.value,
    inputSchema: zodToJsonSchema(ScreenshotTool.shape.arguments),
  },
  handle: async (context, _params) => {
    const screenshotData = await context.sendSocketMessage(
      "browser_screenshot",
      {},
    );
    return {
      content: [
        {
          type: "image",
          data: screenshotData,
          mimeType: "image/png",
        },
      ],
    };
  },
};
