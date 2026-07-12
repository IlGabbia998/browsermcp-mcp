import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

import { mcpConfig } from "@/lib/config/mcp.config";
import { wait } from "@/lib/utils";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

const bundleDir = path.dirname(new URL(import.meta.url).pathname);

function getWslIp(): string | null {
  try {
    const result = execSync("hostname -I", { encoding: "utf-8", timeout: 3000 });
    return result.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

function writeExtensionConfig(port: number) {
  const ip = getWslIp();
  if (!ip) return;

  const configPath = path.resolve(bundleDir, "../extension/ws-config.json");
  try {
    fs.writeFileSync(configPath, JSON.stringify({ wsUrl: `ws://${ip}:${port}` }));
  } catch {
    // ignore — extension will fall back to 127.0.0.1
  }
}

export async function createWebSocketServer(
  port: number = mcpConfig.defaultWsPort,
): Promise<WebSocketServer> {
  killProcessOnPort(port);
  while (await isPortInUse(port)) {
    await wait(100);
  }
  writeExtensionConfig(port);
  return new WebSocketServer({ port, host: "0.0.0.0" });
}
