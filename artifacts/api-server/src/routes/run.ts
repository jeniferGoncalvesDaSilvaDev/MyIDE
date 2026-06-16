import { exec } from "child_process";
import { Router } from "express";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const router = Router();

const TMP_DIR = "/tmp/ide_runs";
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

const TIMEOUT_MS = 10_000;

interface Runner {
  ext: string;
  cmd: (file: string) => string;
}

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

const RUNNERS: Record<string, Runner> = {
  javascript: { ext: "js", cmd: (f) => `node "${f}"` },
  typescript: { ext: "ts", cmd: (f) => `${TSX_BIN} "${f}"` },
  python: { ext: "py", cmd: (f) => `python3 "${f}"` },
  bash: { ext: "sh", cmd: (f) => `bash "${f}"` },
  shell: { ext: "sh", cmd: (f) => `bash "${f}"` },
  ruby: { ext: "rb", cmd: (f) => `ruby "${f}"` },
  php: { ext: "php", cmd: (f) => `php "${f}"` },
  go: { ext: "go", cmd: (f) => `go run "${f}"` },
  rust: { ext: "rs", cmd: (f) => `rustc "${f}" -o "${f}.out" && "${f}.out"` },
  cpp: { ext: "cpp", cmd: (f) => `g++ -o "${f}.out" "${f}" && "${f}.out"` },
  c: { ext: "c", cmd: (f) => `gcc -o "${f}.out" "${f}" && "${f}.out"` },
  java: {
    ext: "java",
    cmd: (f) => {
      const dir = f.substring(0, f.lastIndexOf("/"));
      return `cd "${dir}" && javac "${f}" && java -cp "${dir}" Main`;
    },
  },
};

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

  const runner = RUNNERS[language];
  if (!runner) {
    res.json({
      stdout: "",
      stderr: `Language "${language}" is not yet supported. Supported: ${Object.keys(RUNNERS).join(", ")}.`,
      exitCode: 1,
    });
    return;
  }

  const id = randomUUID();
  const tmpFile = join(TMP_DIR, `run_${id}.${runner.ext}`);

  try {
    writeFileSync(tmpFile, code, "utf8");
  } catch (err) {
    res.status(500).json({ error: "Failed to write temp file" });
    return;
  }

  const cmd = runner.cmd(tmpFile);
  req.log.info({ language, cmd: cmd.slice(0, 80) }, "Executing code");

  exec(cmd, { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
    // Clean up temp files
    try {
      unlinkSync(tmpFile);
      if (existsSync(`${tmpFile}.out`)) unlinkSync(`${tmpFile}.out`);
    } catch {}

    const exitCode = err?.code ?? 0;
    const timedOut =
      err?.signal === "SIGTERM" ||
      (err?.killed === true) ||
      stderr.includes("timeout");

    res.json({
      stdout: stdout || "",
      stderr: timedOut
        ? "⏱ Execution timed out (10s limit exceeded)"
        : stderr || "",
      exitCode: timedOut ? 124 : exitCode,
    });
  });
});

export default router;
