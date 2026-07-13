import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocketServer } from "ws";

import { mcpConfig } from "@/lib/config/mcp.config";
import { wait } from "@/lib/utils";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

const bundleDir = path.dirname(new URL(import.meta.url).pathname);

function isWsl(): boolean {
  try {
    const release = os.release().toLowerCase();
    return release.includes("microsoft") || release.includes("wsl");
  } catch {
    return false;
  }
}

async function getWslIp(): Promise<string | null> {
  return new Promise((resolve) => {
    exec("hostname -I", { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) resolve(null);
      else resolve(stdout.trim().split(/\s+/)[0] || null);
    });
  });
}

async function resolveServerIp(): Promise<string> {
  if (!isWsl()) return "127.0.0.1";
  const ip = await getWslIp();
  return ip || "127.0.0.1";
}

async function writeExtensionConfig(port: number) {
  const ip = await resolveServerIp();
  const configPath = path.resolve(bundleDir, "../extension/ws-config.json");
  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ wsUrl: `ws://${ip}:${port}` }, null, 2),
    );
    console.error(
      `[BrowserMCP] Wrote extension config: ${configPath} -> ws://${ip}:${port}`,
    );
  } catch (err) {
    console.error(
      `[BrowserMCP] Failed to write extension config: ${(err as Error).message}`,
    );
  }
}

export async function createWebSocketServer(
  port: number = mcpConfig.defaultWsPort,
): Promise<WebSocketServer> {
  await killProcessOnPort(port);

  let attempts = 0;
  const maxAttempts = 50;
  while (await isPortInUse(port)) {
    if (++attempts > maxAttempts) {
      throw new Error(
        `Port ${port} is still in use after ${maxAttempts * 100}ms. Another process may be holding it.`,
      );
    }
    await wait(100);
  }

  await writeExtensionConfig(port);

  const wss = new WebSocketServer({
    port,
    host: "0.0.0.0",
    pingInterval: 30000,
    pingTimeout: 60000,
  });

  return new Promise((resolve, reject) => {
    wss.once("listening", () => {
      const address = wss.address();
      const addrString =
        typeof address === "string"
          ? address
          : `ws://${address.address}:${address.port}`;
      console.error(`[BrowserMCP] WebSocket server listening on ${addrString}`);
      resolve(wss);
    });
    wss.once("error", (err) => {
      console.error(`[BrowserMCP] Failed to start WebSocket server: ${err.message}`);
      reject(err);
    });
  });
}
