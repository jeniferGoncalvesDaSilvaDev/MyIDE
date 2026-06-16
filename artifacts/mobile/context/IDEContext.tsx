import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface FileNode {
  name: string;
  path: string;
  language: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface IDEContextType {
  files: Record<string, FileNode>;
  currentFile: FileNode | null;
  apiKey: string;
  githubToken: string;
  lintEnabled: boolean;
  isLoaded: boolean;
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setGithubToken: (token: string) => Promise<void>;
  setLintEnabled: (enabled: boolean) => Promise<void>;
  clearAllFiles: () => Promise<void>;
}

const STORAGE_KEY = "@ide_files_v2";
const API_KEY_STORAGE = "@ide_anthropic_key";
const CURRENT_FILE_STORAGE = "@ide_current_file";
const GITHUB_TOKEN_STORAGE = "@ide_github_token";
const LINT_ENABLED_STORAGE = "@ide_lint_enabled";

const SAMPLE_FILES: Record<string, FileNode> = {
  "README.md": {
    name: "README.md",
    path: "README.md",
    language: "markdown",
    content: `# Mobile IDE\n\nA powerful AI-assisted mobile code editor — similar to Cursor AI.\n\n## Quick Start\n\n- **Files** — create, browse, and import code files\n- **Editor** — syntax highlighting, Run + Preview buttons\n- **Terminal** — full shell access to the server\n- **Chat** — AI code assistant powered by Claude\n- **Settings** — API key, GitHub token, extensions\n\n## Extensions\n\n- **GitHub** — add your PAT in Settings to browse and import repos\n- **Linter** — real-time syntax checking for JS, TS, Python, Bash\n- **Lua / LÖVE 2D** — write Lua scripts (graphical LÖVE 2D needs the desktop app)\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "src/main.ts": {
    name: "main.ts",
    path: "src/main.ts",
    language: "typescript",
    content: `// src/main.ts — tap Run!\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(greet("World"));\nconsole.log("Fibonacci(10):", fibonacci(10));\n\nconst nums: number[] = [3, 1, 4, 1, 5, 9, 2, 6];\nconsole.log("Sorted:", [...nums].sort((a, b) => a - b));\nconsole.log("User:", { name: "Alice", role: "Developer" });\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "src/utils.ts": {
    name: "utils.ts",
    path: "src/utils.ts",
    language: "typescript",
    content: `// src/utils.ts\n\nexport function titleCase(str: string): string {\n  return str.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");\n}\n\nexport function clamp(value: number, min: number, max: number): number {\n  return Math.max(min, Math.min(max, value));\n}\n\nexport function formatBytes(bytes: number): string {\n  const units = ["B", "KB", "MB", "GB"];\n  let size = bytes;\n  let i = 0;\n  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }\n  return \`\${size.toFixed(1)} \${units[i]}\`;\n}\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "games/main.lua": {
    name: "main.lua",
    path: "games/main.lua",
    language: "lua",
    content: `-- main.lua — LÖVE 2D game template\n-- Run with: love . (in games/ folder)\n-- Pure Lua (no graphics) can be executed in the Terminal with: lua main.lua\n\nlocal player = { x = 100, y = 100, speed = 200 }\n\nfunction love.load()\n  love.window.setTitle("My LÖVE 2D Game")\nend\n\nfunction love.update(dt)\n  if love.keyboard.isDown("right") then player.x = player.x + player.speed * dt end\n  if love.keyboard.isDown("left")  then player.x = player.x - player.speed * dt end\n  if love.keyboard.isDown("down")  then player.y = player.y + player.speed * dt end\n  if love.keyboard.isDown("up")    then player.y = player.y - player.speed * dt end\nend\n\nfunction love.draw()\n  love.graphics.setColor(0.3, 0.7, 1)\n  love.graphics.rectangle("fill", player.x, player.y, 40, 40)\n  love.graphics.setColor(1, 1, 1)\n  love.graphics.print("Use arrow keys to move!", 10, 10)\nend\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "styles/main.css": {
    name: "main.css",
    path: "styles/main.css",
    language: "css",
    content: `/* styles/main.css — tap Preview! */\n\n:root {\n  --primary: #2f81f7;\n  --bg: #0d1117;\n  --surface: #161b22;\n  --text: #e6edf3;\n  --muted: #7d8590;\n  --border: #30363d;\n}\n\n* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n  padding: 24px;\n  line-height: 1.6;\n}\n\n.card {\n  background: var(--surface);\n  border: 1px solid var(--border);\n  border-radius: 8px;\n  padding: 20px;\n  margin: 16px 0;\n}\n\nh1 { color: var(--primary); margin-bottom: 12px; }\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "index.html": {
    name: "index.html",
    path: "index.html",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n  <style>\n    body { font-family: system-ui; background:#0d1117; color:#e6edf3; max-width:640px; margin:40px auto; padding:0 20px; }\n    h1 { color:#2f81f7; }\n    .card { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:20px; margin-top:20px; }\n    button { background:#2f81f7; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; margin-top:12px; }\n  </style>\n</head>\n<body>\n  <h1>Hello from Mobile IDE!</h1>\n  <div class="card">\n    <p>Tap <strong>Preview</strong> to render this HTML.</p>\n    <button onclick="this.textContent='Clicked!'">Click me</button>\n  </div>\n</body>\n</html>\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const IDEContext = createContext<IDEContextType | null>(null);

export function IDEProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<Record<string, FileNode>>(SAMPLE_FILES);
  const [currentFile, setCurrentFile] = useState<FileNode | null>(
    SAMPLE_FILES["src/main.ts"] ?? null
  );
  const [apiKey, setApiKeyState] = useState("");
  const [githubToken, setGithubTokenState] = useState("");
  const [lintEnabled, setLintEnabledState] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [storedFiles, storedKey, storedCurrentPath, storedGH, storedLint] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(API_KEY_STORAGE),
          AsyncStorage.getItem(CURRENT_FILE_STORAGE),
          AsyncStorage.getItem(GITHUB_TOKEN_STORAGE),
          AsyncStorage.getItem(LINT_ENABLED_STORAGE),
        ]);

      const loadedFiles: Record<string, FileNode> = storedFiles
        ? JSON.parse(storedFiles)
        : SAMPLE_FILES;

      setFiles(loadedFiles);
      if (storedKey) setApiKeyState(storedKey);
      if (storedGH) setGithubTokenState(storedGH);
      if (storedLint !== null) setLintEnabledState(storedLint === "true");

      const allPaths = Object.keys(loadedFiles);
      const defaultPath =
        storedCurrentPath && loadedFiles[storedCurrentPath]
          ? storedCurrentPath
          : allPaths[0] ?? null;

      if (defaultPath) setCurrentFile(loadedFiles[defaultPath] ?? null);
    } catch {
      setFiles(SAMPLE_FILES);
      setCurrentFile(SAMPLE_FILES["src/main.ts"] ?? null);
    } finally {
      setIsLoaded(true);
    }
  }

  async function createFile(filePath: string) {
    const trimmed = filePath.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!trimmed) return;
    const parts = trimmed.split("/");
    const name = parts[parts.length - 1];
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const newFile: FileNode = {
      name,
      path: trimmed,
      language: EXT_MAP[ext] ?? "text",
      content: getTemplate(name),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...files, [trimmed]: newFile };
    setFiles(updated);
    setCurrentFile(newFile);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(CURRENT_FILE_STORAGE, trimmed);
  }

  async function deleteFile(path: string) {
    const updated = { ...files };
    delete updated[path];
    setFiles(updated);
    if (currentFile?.path === path) {
      const remaining = Object.values(updated);
      const next = remaining[0] ?? null;
      setCurrentFile(next);
      if (next) await AsyncStorage.setItem(CURRENT_FILE_STORAGE, next.path);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function updateFileContent(path: string, content: string) {
    const file = files[path];
    if (!file) return;
    const updated: FileNode = { ...file, content, updatedAt: new Date().toISOString() };
    const updatedFiles = { ...files, [path]: updated };
    setFiles(updatedFiles);
    if (currentFile?.path === path) setCurrentFile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFiles));
  }

  async function openFile(path: string) {
    const file = files[path];
    if (!file) return;
    setCurrentFile(file);
    await AsyncStorage.setItem(CURRENT_FILE_STORAGE, path);
  }

  async function setApiKey(key: string) {
    setApiKeyState(key);
    await AsyncStorage.setItem(API_KEY_STORAGE, key);
  }

  async function setGithubToken(token: string) {
    setGithubTokenState(token);
    await AsyncStorage.setItem(GITHUB_TOKEN_STORAGE, token);
  }

  async function setLintEnabled(enabled: boolean) {
    setLintEnabledState(enabled);
    await AsyncStorage.setItem(LINT_ENABLED_STORAGE, String(enabled));
  }

  async function clearAllFiles() {
    setFiles(SAMPLE_FILES);
    const firstFile = SAMPLE_FILES["src/main.ts"] ?? Object.values(SAMPLE_FILES)[0];
    setCurrentFile(firstFile ?? null);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_FILES));
    if (firstFile) await AsyncStorage.setItem(CURRENT_FILE_STORAGE, firstFile.path);
  }

  return (
    <IDEContext.Provider
      value={{
        files,
        currentFile,
        apiKey,
        githubToken,
        lintEnabled,
        isLoaded,
        createFile,
        deleteFile,
        updateFileContent,
        openFile,
        setApiKey,
        setGithubToken,
        setLintEnabled,
        clearAllFiles,
      }}
    >
      {children}
    </IDEContext.Provider>
  );
}

export function useIDE() {
  const ctx = useContext(IDEContext);
  if (!ctx) throw new Error("useIDE must be used within IDEProvider");
  return ctx;
}

export const EXT_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  mjs: "javascript",
  jsx: "javascript",
  py: "python",
  md: "markdown",
  json: "json",
  css: "css",
  html: "html",
  htm: "html",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yaml: "yaml",
  yml: "yaml",
  txt: "text",
  xml: "text",
  toml: "text",
  gitignore: "text",
  env: "text",
  java: "java",
  rb: "ruby",
  go: "go",
  rs: "rust",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "c",
  php: "php",
  lua: "lua",
  kt: "text",
  swift: "text",
  cs: "text",
  sql: "text",
};

function getTemplate(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const base = name.replace(/\.\w+$/, "");

  if (ext === "ts" || ext === "tsx") return `// ${name}\n\nexport {};\n`;
  if (ext === "js" || ext === "mjs" || ext === "jsx") return `// ${name}\n\n`;
  if (ext === "py") return `# ${name}\n\n`;
  if (ext === "md") return `# ${base}\n\n`;
  if (ext === "json") return `{\n  \n}\n`;
  if (ext === "css") return `/* ${name} */\n\nbody {\n  \n}\n`;
  if (ext === "html")
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${base}</title>\n</head>\n<body>\n  \n</body>\n</html>\n`;
  if (ext === "java")
    return `public class ${base.charAt(0).toUpperCase() + base.slice(1)} {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n`;
  if (ext === "rb") return `# ${name}\n\nputs "Hello, Ruby!"\n`;
  if (ext === "go")
    return `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, Go!")\n}\n`;
  if (ext === "rs") return `fn main() {\n    println!("Hello, Rust!");\n}\n`;
  if (ext === "cpp")
    return `#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++!" << std::endl;\n    return 0;\n}\n`;
  if (ext === "c")
    return `#include <stdio.h>\n\nint main() {\n    printf("Hello, C!\\n");\n    return 0;\n}\n`;
  if (ext === "sh") return `#!/bin/bash\n\necho "Hello!"\n`;
  if (ext === "lua") {
    if (base === "main") {
      return `-- main.lua — LÖVE 2D game\n-- Run graphically: love . (needs LÖVE 2D installed)\n-- Run as script: lua main.lua\n\nfunction love.load()\nend\n\nfunction love.update(dt)\nend\n\nfunction love.draw()\n  love.graphics.print("Hello, LÖVE 2D!", 100, 100)\nend\n`;
    }
    return `-- ${name}\n\nlocal function main()\n  print("Hello from Lua!")\nend\n\nmain()\n`;
  }
  return "";
}
