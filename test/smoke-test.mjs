#!/usr/bin/env node
import { spawn } from "child_process";
import { createInterface } from "readline";

const proc = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd(),
});

const rl = createInterface({ input: proc.stdout });
let initialized = false;
const tools = [];

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.id === "init" && msg.result) {
      initialized = true;
      // Send tools/list
      proc.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "list-tools",
          method: "tools/list",
        }) + "\n"
      );
    }
    if (msg.id === "list-tools" && msg.result?.tools) {
      console.log(`✅ ${msg.result.tools.length} tools registered:`);
      msg.result.tools.forEach((t) => console.log(`   - ${t.name}`));
      proc.kill();
      process.exit(0);
    }
  } catch {}
});

// Wait a tick then send initialize
setTimeout(() => {
  proc.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    }) + "\n"
  );
}, 500);

// Timeout
setTimeout(() => {
  console.log("❌ Timeout waiting for response");
  proc.kill();
  process.exit(1);
}, 10000);
