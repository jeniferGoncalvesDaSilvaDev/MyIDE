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
  isLoaded: boolean;
  createFile: (name: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
}

const STORAGE_KEY = "@ide_files_v1";
const API_KEY_STORAGE = "@ide_anthropic_key";
const CURRENT_FILE_STORAGE = "@ide_current_file";

const README_CONTENT = `# Mobile IDE

A powerful AI-assisted mobile code editor — similar to Cursor AI.

---

## Features

### Files Tab
- **Create** files with the \`+\` button — supports .ts, .js, .py, .md, .css, .json, .yaml, .html
- **Import** any text file from your device with the upload (↑) button
- **Delete** files by tapping the trash icon
- Tap a file to open it in the Editor

### Editor Tab
- **Syntax highlighting** for TypeScript, JavaScript, Python, CSS, HTML, Markdown, JSON, YAML
- **Line numbers** for easy navigation
- **Run button** — executes JavaScript and TypeScript files directly on device
- **Console panel** — see \`console.log\` output, errors, and warnings
- **Edit mode** — tap Edit to enter fullscreen editing

### Chat Tab
- **AI code assistant** powered by Claude (Anthropic)
- Automatically uses your open file as context
- Ask questions, request improvements, get explanations
- Requires an Anthropic API key (set in Settings)

### Settings Tab
- Enter your **Anthropic API key** to enable AI chat
- Get a free key at [console.anthropic.com](https://console.anthropic.com)

---

## Running Code

The Run button supports **JavaScript** and **TypeScript**.

\`\`\`typescript
const message: string = "Hello, World!";
console.log(message);

function add(a: number, b: number): number {
  return a + b;
}

console.log(add(5, 3)); // 8
\`\`\`

> Other languages (Python, CSS, etc.) cannot be executed on-device.

---

## AI Chat Tips

- Ask **"Explain this code"** for a walkthrough
- Ask **"Find bugs in this file"** for a code review
- Ask **"Refactor this function"** to improve code quality
- Ask **"Write unit tests"** to generate tests
- Ask **"Add TypeScript types"** to improve type safety

---

## Keyboard Shortcuts (Web)

| Action | Shortcut |
|--------|----------|
| Save file | Tap Save button |
| Run code | Tap Run button |
| Clear console | Tap trash icon |

---

*Built with Expo + React Native. AI powered by Anthropic Claude.*
`;

const SAMPLE_FILES: Record<string, FileNode> = {
  "README.md": {
    name: "README.md",
    path: "README.md",
    language: "markdown",
    content: README_CONTENT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "main.ts": {
    name: "main.ts",
    path: "main.ts",
    language: "typescript",
    content: `// main.ts — try tapping the Run button!

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Greeting
console.log(greet("World"));

// Fibonacci sequence
console.log("Fibonacci(10):", fibonacci(10));

// Array operations
const numbers: number[] = [1, 2, 3, 4, 5];
const doubled = numbers.map((n) => n * 2);
console.log("Doubled:", doubled);

// Object
const user = { name: "Alice", age: 30, role: "Developer" };
console.log("User:", user);
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "utils.ts": {
    name: "utils.ts",
    path: "utils.ts",
    language: "typescript",
    content: `// utils.ts — utility functions

/**
 * Capitalizes the first letter of each word
 */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Formats bytes to a human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return \`\${size.toFixed(1)} \${units[unitIndex]}\`;
}

/**
 * Debounce: delays execution until after wait ms have passed
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "styles.css": {
    name: "styles.css",
    path: "styles.css",
    language: "css",
    content: `/* styles.css — application styles */

:root {
  --color-primary: #2f81f7;
  --color-background: #0d1117;
  --color-surface: #161b22;
  --color-text: #e6edf3;
  --color-muted: #7d8590;
  --color-border: #30363d;
  --color-success: #7ee787;
  --color-warning: #f2cc60;
  --color-error: #f85149;
  --radius: 6px;
  --font-mono: "JetBrains Mono", Menlo, "Courier New", monospace;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: var(--color-background);
  color: var(--color-text);
  line-height: 1.6;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.button:hover {
  opacity: 0.9;
}

code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--color-surface);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const IDEContext = createContext<IDEContextType | null>(null);

export function IDEProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<Record<string, FileNode>>(SAMPLE_FILES);
  const [currentFile, setCurrentFile] = useState<FileNode | null>(null);
  const [apiKey, setApiKeyState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [storedFiles, storedKey, storedCurrentPath] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(API_KEY_STORAGE),
        AsyncStorage.getItem(CURRENT_FILE_STORAGE),
      ]);

      const loadedFiles: Record<string, FileNode> = storedFiles
        ? JSON.parse(storedFiles)
        : SAMPLE_FILES;

      setFiles(loadedFiles);
      if (storedKey) setApiKeyState(storedKey);

      const defaultPath =
        storedCurrentPath && loadedFiles[storedCurrentPath]
          ? storedCurrentPath
          : Object.keys(loadedFiles)[0] ?? null;

      if (defaultPath) setCurrentFile(loadedFiles[defaultPath] ?? null);
    } catch {
      setFiles(SAMPLE_FILES);
      setCurrentFile(SAMPLE_FILES["README.md"] ?? null);
    } finally {
      setIsLoaded(true);
    }
  }

  async function createFile(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ext = trimmed.split(".").pop()?.toLowerCase() ?? "";
    const newFile: FileNode = {
      name: trimmed,
      path: trimmed,
      language: EXT_MAP[ext] ?? "text",
      content: getTemplate(trimmed),
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
    const updated: FileNode = {
      ...file,
      content,
      updatedAt: new Date().toISOString(),
    };
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

  return (
    <IDEContext.Provider
      value={{
        files,
        currentFile,
        apiKey,
        isLoaded,
        createFile,
        deleteFile,
        updateFileContent,
        openFile,
        setApiKey,
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

const EXT_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  md: "markdown",
  json: "json",
  css: "css",
  html: "html",
  sh: "bash",
  bash: "bash",
  yaml: "yaml",
  yml: "yaml",
  txt: "text",
  xml: "text",
  toml: "text",
  gitignore: "text",
  env: "text",
};

function getTemplate(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ts" || ext === "tsx") return `// ${name}\n\nexport {};\n`;
  if (ext === "js" || ext === "jsx") return `// ${name}\n\n`;
  if (ext === "py") return `# ${name}\n\n`;
  if (ext === "md") return `# ${name.replace(/\.\w+$/, "")}\n\n`;
  if (ext === "json") return `{\n  \n}\n`;
  if (ext === "css") return `/* ${name} */\n\n`;
  if (ext === "html") return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>\n`;
  return ``;
}
