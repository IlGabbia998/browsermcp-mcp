import { execSync } from "node:child_process";
import net from "node:net";

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

export function killProcessOnPort(port: number) {
  try {
    if (process.platform === "win32") {
      execSync(
        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
        { stdio: "ignore" },
      );
    } else {
      const pids = execSync(`lsof -ti:${port} 2>/dev/null || true`, {
        encoding: "utf-8",
      })
        .trim()
        .split("\n")
        .filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          // already dead
        }
      }
    }
  } catch {
    // ignore — port may already be free
  }
}
