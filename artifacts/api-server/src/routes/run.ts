import { exec, execSync } from "child_process";
import { Router } from "express";
import { existsSync, mkdirSync, unlinkSync, rmdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();

const TMP_DIR = "/tmp/ide_runs";
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// Capture full PATH from login shell so nix-installed tools (javac, lua, etc.) are available.
let EXEC_PATH = process.env.PATH ?? "/usr/bin:/bin";
try {
  EXEC_PATH = execSync('bash -l -c "echo $PATH"', {
    encoding: "utf8",
    timeout: 5000,
  }).trim();
} catch {
  /* keep current PATH */
}
const EXEC_ENV = { ...process.env, PATH: EXEC_PATH };

const TIMEOUT_MS = 15_000;

import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const TSX_BIN = (() => {
  try {
    const pkgPath = _require.resolve("tsx/package.json");
    const dir = pkgPath.substring(0, pkgPath.lastIndexOf("/"));
    return `node "${dir}/dist/cli.mjs"`;
  } catch {
    return "tsx";
  }
})();

// Extract the public class name from Java source code
function extractJavaClassName(code: string): string {
  const m = code.match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  return m?.[1] ?? "Main";
}

const NOT_EXECUTABLE = new Set([
  "css",
  "html",
  "markdown",
  "json",
  "yaml",
  "xml",
  "text",
]);

router.post("/", (req, res) => {
  const { code, language } = req.body as {
    code: string;
    language: string;
  };

  if (!code || !language) {
    res.status(400).json({ error: "code and language are required" });
    return;
  }

  if (NOT_EXECUTABLE.has(language)) {
    res.json({
      stdout: "",
      stderr: `${language.toUpperCase()} files cannot be executed — they are markup/config files, not programs.`,
      exitCode: 1,
    });
    return;
  }

  const id = randomUUID();
  let tmpFile: string;
  let tmpDir: string | null = null;
  let cmd: string;

  if (language === "java") {
    // Java: file MUST be named <ClassName>.java or javac fails
    const className = extractJavaClassName(code);
    tmpDir = join(TMP_DIR, `java_${id}`);
    mkdirSync(tmpDir, { recursive: true });
    tmpFile = join(tmpDir, `${className}.java`);
    cmd = `cd "${tmpDir}" && javac "${tmpFile}" && java -cp "${tmpDir}" ${className}`;
  } else {
    const extMap: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      bash: "sh",
      shell: "sh",
      ruby: "rb",
      php: "php",
      go: "go",
      rust: "rs",
      cpp: "cpp",
      c: "c",
      lua: "lua",
    };
    const ext = extMap[language];
    if (!ext) {
      res.json({
        stdout: "",
        stderr: `Language "${language}" is not yet supported. Supported: javascript, typescript, python, bash, java, ruby, go, rust, cpp, c, php, lua.`,
        exitCode: 1,
      });
      return;
    }
    tmpFile = join(TMP_DIR, `run_${id}.${ext}`);

    switch (language) {
      case "javascript":
        cmd = `node "${tmpFile}"`;
        break;
      case "typescript":
        cmd = `${TSX_BIN} "${tmpFile}"`;
        break;
      case "python":
        cmd = `python3 "${tmpFile}"`;
        break;
      case "bash":
      case "shell":
        cmd = `bash "${tmpFile}"`;
        break;
      case "ruby":
        cmd = `ruby "${tmpFile}"`;
        break;
      case "php":
        cmd = `php "${tmpFile}"`;
        break;
      case "go":
        cmd = `go run "${tmpFile}"`;
        break;
      case "rust":
        cmd = `rustc "${tmpFile}" -o "${tmpFile}.out" && "${tmpFile}.out"`;
        break;
      case "cpp":
        cmd = `g++ -o "${tmpFile}.out" "${tmpFile}" && "${tmpFile}.out"`;
        break;
      case "c":
        cmd = `gcc -o "${tmpFile}.out" "${tmpFile}" && "${tmpFile}.out"`;
        break;
      case "lua":
        cmd = `lua "${tmpFile}" 2>/dev/null || luajit "${tmpFile}" 2>/dev/null || echo "Lua not installed on this server. Pure Lua scripts need lua or luajit. For LÖVE 2D games, run: love <folder>"`;
        break;
      default:
        cmd = `echo "Unsupported language: ${language}"`;
    }
  }

  try {
    writeFileSync(tmpFile, code, "utf8");
  } catch {
    res.status(500).json({ error: "Failed to write temp file" });
    return;
  }

  req.log.info({ language, cmd: cmd.slice(0, 80) }, "Executing code");

  exec(cmd, { timeout: TIMEOUT_MS, env: EXEC_ENV }, (err, stdout, stderr) => {
    // Cleanup
    try { unlinkSync(tmpFile); } catch {}
    if (tmpDir) {
      try {
        // Remove class files too
        const { readdirSync } = require("fs");
        for (const f of readdirSync(tmpDir)) {
          try { unlinkSync(join(tmpDir!, f)); } catch {}
        }
        rmdirSync(tmpDir);
      } catch {}
    }
    try {
      if (existsSync(`${tmpFile}.out`)) unlinkSync(`${tmpFile}.out`);
    } catch {}

    const timedOut =
      err?.signal === "SIGTERM" || err?.killed === true;

    res.json({
      stdout: stdout || "",
      stderr: timedOut
        ? "⏱ Execution timed out (15s limit exceeded)"
        : stderr || "",
      exitCode: timedOut ? 124 : (err?.code ?? 0),
    });
  });
});

export default router;
