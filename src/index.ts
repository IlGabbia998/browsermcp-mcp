#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";

import { appConfig } from "@/lib/config/app.config";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as extended from "@/tools/extended";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const allTools: Tool[] = [
  // Core
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  snapshot.drag,
  common.pressKey,
  common.waitTool,
  custom.getConsoleLogs,
  custom.screenshot,
  // Extended
  extended.scroll,
  extended.newTab,
  extended.reload,
  extended.listTabs,
  extended.closeTab,
  extended.switchTab,
  extended.findText,
  extended.executeJs,
  extended.getLinks,
  extended.getElements,
  extended.extractTable,
  extended.extractMeta,
  extended.extractImages,
  extended.getCookies,
  extended.setCookies,
  extended.getStorage,
  extended.setStorage,
  extended.waitFor,
  extended.highlight,
  extended.readability,
  extended.rightClick,
  extended.doubleClick,
  extended.injectCss,
  extended.networkLog,
  extended.consoleLog,
  extended.getComputedStyle,
];

const resources: Resource[] = [];

async function createServer(): Promise<Server> {
  return createServerWithTools({
    name: appConfig.name,
    version: packageJSON.version,
    tools: allTools,
    resources,
  });
}

program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .action(async () => {
    const server = await createServer();
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  });
program.parse(process.argv);
