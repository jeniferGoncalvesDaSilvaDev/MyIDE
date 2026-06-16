import { Router } from "express";
import { exec } from "child_process";
import { existsSync } from "fs";
import { resolve, join } from "path";

const router = Router();
const WORKSPACE_ROOT = "/home/runner/workspace";

router.post("/", (req, res) => {
  const { command, cwd = WORKSPACE_ROOT } = req.body as {
    command: string;
    cwd?: string;
  };

  if (!command || typeof command !== "string") {
    res.status(400).json({ error: "command is required" });
    return;
  }

  // Resolve safe cwd
  const rawCwd = cwd.startsWith("/") ? cwd : join(WORKSPACE_ROOT, cwd);
  const safeCwd = existsSync(rawCwd) ? rawCwd : WORKSPACE_ROOT;

  const trimmed = command.trim();

  // Handle 'cd' specially — it can't change the server process cwd
  if (trimmed === "cd" || trimmed === "cd ~" || trimmed === "cd ~/") {
    res.json({ stdout: "", stderr: "", exitCode: 0, cwd: WORKSPACE_ROOT });
    return;
  }

  if (/^cd(\s|$)/.test(trimmed)) {
    const arg = trimmed.slice(2).trim().replace(/^~/, WORKSPACE_ROOT);
    if (!arg || arg === "-") {
      res.json({ stdout: "", stderr: "", exitCode: 0, cwd: WORKSPACE_ROOT });
      return;
    }
    const target = arg.startsWith("/") ? arg : resolve(safeCwd, arg);
    if (existsSync(target)) {
      res.json({ stdout: "", stderr: "", exitCode: 0, cwd: resolve(target) });
    } else {
      res.json({
        stdout: "",
        stderr: `bash: cd: ${arg}: No such file or directory`,
        exitCode: 1,
        cwd: safeCwd,
      });
    }
    return;
  }

  req.log.info(
    { cmd: trimmed.slice(0, 80), cwd: safeCwd },
    "Terminal execute"
  );

  exec(
    trimmed,
    { cwd: safeCwd, timeout: 30_000, shell: "/bin/bash" },
    (err, stdout, stderr) => {
      const timedOut = err?.killed === true || err?.signal === "SIGTERM";
      const exitCode = timedOut ? 124 : (err?.code ?? 0);
      res.json({
        stdout: stdout || "",
        stderr: timedOut
          ? "⏱ Command timed out after 30 seconds"
          : stderr || "",
        exitCode,
        cwd: safeCwd,
      });
    }
  );
});

export default router;
