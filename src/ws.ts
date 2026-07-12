import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

import { mcpConfig } from "@/lib/config/mcp.config";
import { wait } from "@/lib/utils";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

const bundleDir = path.dirname(new URL(import.meta.url).pathname);

async function getWslIp(): Promise<string | null> {
  return new Promise((resolve) => {
    exec("hostname -I", { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) resolve(null);
      else resolve(stdout.trim().split(/\s+/)[0] || null);
    });
  });
}

async function writeExtensionConfig(port: number) {
  const ip = await getWslIp();
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
  await killProcessOnPort(port);
  while (await isPortInUse(port)) {
    await wait(100);
  }
  await writeExtensionConfig(port);
  return new WebSocketServer({ port, host: "0.0.0.0" });
}
