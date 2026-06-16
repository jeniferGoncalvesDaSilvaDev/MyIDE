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
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
}

const STORAGE_KEY = "@ide_files_v2";
const API_KEY_STORAGE = "@ide_anthropic_key";
const CURRENT_FILE_STORAGE = "@ide_current_file";

const README_CONTENT = `# Mobile IDE

A powerful AI-assisted mobile code editor — similar to Cursor AI.

---

## Features

### Files Tab
- **Create** files with the \`+\` button — supports .ts, .js, .py, .java, .md, .css, .json, .yaml, .html
- **Folder structure** — type \`src/main.ts\` to place files inside folders
- **Import** any text file from your device with the upload button
- **Delete** files by tapping the trash icon
- Tap a file to open it in the Editor

### Editor Tab
- **Syntax highlighting** for TypeScript, JavaScript, Python, Java, CSS, HTML, and more
- **Line numbers** for easy navigation
- **Run button** — executes code on the server (JS, TS, Python, Bash, C, C++)
- **Preview button** — renders HTML and CSS files visually
- **Console panel** — see output, errors, and warnings

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

Tap the green **Run** button in the Editor for:

\`\`\`typescript
// TypeScript — types are fully supported
const greet = (name: string): string => \`Hello, \${name}!\`;
console.log(greet("World"));
\`\`\`

\`\`\`python
# Python 3
for i in range(5):
    print(f"item {i}")
\`\`\`

\`\`\`java
// Java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
\`\`\`

---

## HTML Preview

Open an \`.html\` or \`.css\` file and tap **Preview** to render it live.

---

## AI Chat Tips

- **"Explain this code"** — get a walkthrough
- **"Find bugs"** — code review
- **"Refactor this function"** — improve quality
- **"Write unit tests"** — generate test cases
- **"Add TypeScript types"** — improve type safety

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
  "src/main.ts": {
    name: "main.ts",
    path: "src/main.ts",
    language: "typescript",
    content: `// src/main.ts — tap Run to execute!\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(greet("World"));\nconsole.log("Fibonacci(10):", fibonacci(10));\n\nconst nums: number[] = [1, 2, 3, 4, 5];\nconsole.log("Doubled:", nums.map((n) => n * 2));\nconsole.log("User:", { name: "Alice", age: 30, role: "Developer" });\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "src/utils.ts": {
    name: "utils.ts",
    path: "src/utils.ts",
    language: "typescript",
    content: `// src/utils.ts\n\nexport function titleCase(str: string): string {\n  return str\n    .split(" ")\n    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())\n    .join(" ");\n}\n\nexport function clamp(value: number, min: number, max: number): number {\n  return Math.max(min, Math.min(max, value));\n}\n\nexport function formatBytes(bytes: number): string {\n  const units = ["B", "KB", "MB", "GB"];\n  let size = bytes;\n  let i = 0;\n  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }\n  return \`\${size.toFixed(1)} \${units[i]}\`;\n}\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "styles/main.css": {
    name: "main.css",
    path: "styles/main.css",
    language: "css",
    content: `/* styles/main.css — tap Preview to render! */\n\n:root {\n  --primary: #2f81f7;\n  --bg: #0d1117;\n  --surface: #161b22;\n  --text: #e6edf3;\n  --muted: #7d8590;\n  --border: #30363d;\n  --radius: 8px;\n}\n\n* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  background: var(--bg);\n  color: var(--text);\n  padding: 24px;\n  line-height: 1.6;\n}\n\n.card {\n  background: var(--surface);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 20px;\n  margin: 16px 0;\n}\n\nh1 { color: var(--primary); margin-bottom: 12px; }\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "index.html": {
    name: "index.html",
    path: "index.html",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n  <style>\n    body {\n      font-family: system-ui, sans-serif;\n      max-width: 640px;\n      margin: 40px auto;\n      padding: 0 20px;\n      background: #0d1117;\n      color: #e6edf3;\n    }\n    h1 { color: #2f81f7; }\n    .card {\n      background: #161b22;\n      border: 1px solid #30363d;\n      border-radius: 8px;\n      padding: 20px;\n      margin-top: 20px;\n    }\n    button {\n      background: #2f81f7;\n      color: white;\n      border: none;\n      padding: 10px 20px;\n      border-radius: 6px;\n      cursor: pointer;\n      margin-top: 12px;\n    }\n  </style>\n</head>\n<body>\n  <h1>Hello from Mobile IDE!</h1>\n  <div class="card">\n    <p>Tap <strong>Preview</strong> to render this HTML file.</p>\n    <button onclick="alert('It works!')">Click me</button>\n  </div>\n  <script>\n    console.log("Page loaded!");\n  </script>\n</body>\n</html>\n`,
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

    // Extract just the filename from the path
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
      if (next)
        await AsyncStorage.setItem(CURRENT_FILE_STORAGE, next.path);
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
  if (ext === "rs")
    return `fn main() {\n    println!("Hello, Rust!");\n}\n`;
  if (ext === "cpp")
    return `#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++!" << std::endl;\n    return 0;\n}\n`;
  if (ext === "c")
    return `#include <stdio.h>\n\nint main() {\n    printf("Hello, C!\\n");\n    return 0;\n}\n`;
  if (ext === "sh") return `#!/bin/bash\n\necho "Hello from shell!"\n`;
  return "";
}
