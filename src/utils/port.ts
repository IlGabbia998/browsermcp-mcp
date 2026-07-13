import { exec } from "node:child_process";
import net from "node:net";

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: any) => {
      // EACCES means we can't bind the port (still "in use" for our purposes)
      resolve(err.code !== "EACCES");
    });
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
      return;
    }

    // Try lsof first (common on macOS and many Linux distros), then fuser as fallback.
    exec(`lsof -ti:${port} 2>/dev/null || true`, { timeout: 3000 }, (_err, stdout) => {
      const pids = stdout?.trim().split("\n").filter(Boolean) ?? [];
      if (pids.length) {
        for (const pid of pids) {
          try {
            process.kill(Number(pid), "SIGKILL");
          } catch {
            // already dead or no permission
          }
        }
        resolve();
        return;
      }

      // Fallback for systems where lsof is missing (e.g. minimal Pop!_OS/Ubuntu installs).
      exec(`fuser -k ${port}/tcp 2>/dev/null || true`, { timeout: 3000 }, () => {
        resolve();
      });
    });
  });
}
