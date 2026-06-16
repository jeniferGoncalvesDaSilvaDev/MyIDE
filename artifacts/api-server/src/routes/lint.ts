import { Router } from "express";
import { exec } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { createRequire } from "module";

const router = Router();
const TMP_DIR = "/tmp/ide_lint";
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

const _require = createRequire(import.meta.url);
const TSX_BIN = (() => {
  try {
    const p = _require.resolve("tsx/package.json");
    const dir = p.slice(0, p.lastIndexOf("/"));
    return `node "${dir}/dist/cli.mjs"`;
  } catch {
    return "tsx";
  }
})();

export interface LintError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

const LINTABLE = new Set([
  "javascript",
  "typescript",
  "python",
  "bash",
  "lua",
]);

router.post("/", (req, res) => {
  const { code, language } = req.body as {
    code: string;
    language: string;
  };

  if (!code || !language || !LINTABLE.has(language)) {
    res.json({ errors: [] });
    return;
  }

  const id = randomUUID();
  const extMap: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    bash: "sh",
    lua: "lua",
  };

  const ext = extMap[language] ?? "txt";
  const tmpFile = join(TMP_DIR, `lint_${id}.${ext}`);

  try {
    writeFileSync(tmpFile, code, "utf8");
  } catch {
    res.json({ errors: [] });
    return;
  }

  const cleanup = () => {
    try { unlinkSync(tmpFile); } catch {}
  };

  let cmd: string;

  switch (language) {
    case "javascript":
      cmd = `node --check "${tmpFile}" 2>&1; true`;
      break;
    case "typescript":
      cmd = `${TSX_BIN} "${tmpFile}" --noEmit 2>&1; true`;
      break;
    case "python":
      cmd = `python3 -m py_compile "${tmpFile}" 2>&1; true`;
      break;
    case "bash":
      cmd = `bash -n "${tmpFile}" 2>&1; true`;
      break;
    case "lua":
      cmd = `luac -p "${tmpFile}" 2>&1; true`;
      break;
    default:
      cleanup();
      res.json({ errors: [] });
      return;
  }

  exec(cmd, { timeout: 8_000 }, (_, stdout) => {
    cleanup();
    const output = (stdout || "").trim();
    if (!output) {
      res.json({ errors: [] });
      return;
    }
    const errors = parseErrors(output, language, tmpFile);
    res.json({ errors });
  });
});

function parseErrors(
  output: string,
  language: string,
  file: string
): LintError[] {
  const errors: LintError[] = [];
  const lines = output.split("\n").filter((l) => l.trim());

  if (language === "python") {
    for (let i = 0; i < lines.length; i++) {
      const lm = lines[i].match(/line (\d+)/);
      if (lm) {
        const next = lines[i + 1] ?? "";
        const mm = next.match(/(SyntaxError|IndentationError|NameError|TypeError|ValueError): (.+)/);
        errors.push({
          line: parseInt(lm[1]),
          column: 1,
          message: mm ? `${mm[1]}: ${mm[2]}` : "Syntax error",
          severity: "error",
        });
        break;
      }
    }
  } else if (language === "bash") {
    for (const line of lines) {
      const m = line.match(/line (\d+): (.+)/);
      if (m) {
        errors.push({ line: parseInt(m[1]), column: 1, message: m[2], severity: "error" });
      }
    }
  } else if (language === "javascript" || language === "typescript") {
    for (const line of lines) {
      // Node format: /tmp/file.js:3
      // TSX format: /tmp/file.ts(3,1): error TS1234: msg
      // TSX format 2: /tmp/file.ts:3:1 - error TS...: msg
      const m1 = line.match(/[^/\\]+?:(\d+):(\d+).*?(?:error|warning)[^:]*: (.+)/i);
      const m2 = line.match(/[^/\\]+?\((\d+),(\d+)\).*?: (.+)/);
      const m3 = line.match(/[^/\\]+?:(\d+)\s*$/) || line.match(/SyntaxError: (.+)/);

      if (m1) {
        errors.push({ line: parseInt(m1[1]), column: parseInt(m1[2]), message: m1[3], severity: "error" });
      } else if (m2) {
        errors.push({ line: parseInt(m2[1]), column: parseInt(m2[2]), message: m2[3], severity: "error" });
      } else if (m3) {
        const lineNum = m3[1] ? parseInt(m3[1]) : 1;
        const msg = line.match(/SyntaxError: (.+)/)?.[1] ?? line;
        errors.push({ line: lineNum, column: 1, message: msg, severity: "error" });
      }
    }
  } else if (language === "lua") {
    for (const line of lines) {
      const m = line.match(/:(\d+): (.+)/);
      if (m) {
        errors.push({ line: parseInt(m[1]), column: 1, message: m[2], severity: "error" });
      }
    }
  }

  return errors.slice(0, 15);
}

export default router;
