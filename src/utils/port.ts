import { exec } from "node:child_process";
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

export async function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      exec(
        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
        { timeout: 3000 },
        () => resolve(),
      );
    } else {
      exec(`lsof -ti:${port} 2>/dev/null || true`, { timeout: 3000 }, (err, stdout) => {
        if (stdout) {
          for (const pid of stdout.trim().split("\n").filter(Boolean)) {
            try {
              process.kill(Number(pid), "SIGKILL");
            } catch {
              // already dead
            }
          }
        }
        resolve();
      });
    }
  });
}
