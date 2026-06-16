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

const SAMPLE_FILES: Record<string, FileNode> = {
  "main.ts": {
    name: "main.ts",
    path: "main.ts",
    language: "typescript",
    content: `// Welcome to Mobile IDE
// An AI-powered code editor for your phone

import { greet, add, formatDate } from './utils';

async function main(): Promise<void> {
  const message = greet('World');
  console.log(message);

  const result = add(10, 20);
  console.log(\`10 + 20 = \${result}\`);

  const today = formatDate(new Date());
  console.log(\`Today is: \${today}\`);
}

main().catch(console.error);
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "utils.ts": {
    name: "utils.ts",
    path: "utils.ts",
    language: "typescript",
    content: `/**
 * Utility functions for the application
 */

/**
 * Returns a greeting message
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

/**
 * Adds two numbers together
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Formats a date to a readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Checks if a string is empty or whitespace
 */
export function isEmpty(str: string): boolean {
  return str.trim().length === 0;
}
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "README.md": {
    name: "README.md",
    path: "README.md",
    language: "markdown",
    content: `# Mobile IDE

A powerful AI-assisted code editor for mobile devices.

## Features

- **Syntax Highlighting** — TypeScript, JavaScript, Python, and more
- **AI Assistant** — Powered by Claude for intelligent code help
- **File Management** — Create, edit, and organize your files
- **Dark Theme** — Easy on the eyes for long coding sessions

## Getting Started

1. Browse your files in the **Files** tab
2. Tap a file to open it in the **Editor**
3. Use the **Chat** tab to get AI help with your code
4. Add your Anthropic API key in **Settings**

## AI Assistant

The AI assistant knows about your currently open file.
Ask questions like:

- "Explain this code"
- "How can I improve this?"
- "Add error handling to main()"
- "Write unit tests for these functions"
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "styles.css": {
    name: "styles.css",
    path: "styles.css",
    language: "css",
    content: `/* App Styles */

:root {
  --color-primary: #0969da;
  --color-background: #ffffff;
  --color-text: #1f2328;
  --color-border: #d1d9e0;
  --radius: 6px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: var(--color-background);
  color: var(--color-text);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.button {
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.button:hover {
  opacity: 0.9;
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
      setCurrentFile(SAMPLE_FILES["main.ts"] ?? null);
    } finally {
      setIsLoaded(true);
    }
  }

  async function createFile(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ext = trimmed.split(".").pop()?.toLowerCase() ?? "";
    const language = EXT_MAP[ext] ?? "text";
    const newFile: FileNode = {
      name: trimmed,
      path: trimmed,
      language,
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
  yaml: "yaml",
  yml: "yaml",
  txt: "text",
};

function getTemplate(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ts" || ext === "tsx")
    return `// ${name}\n\nexport {};\n`;
  if (ext === "js" || ext === "jsx")
    return `// ${name}\n\n`;
  if (ext === "py")
    return `# ${name}\n\n`;
  if (ext === "md")
    return `# ${name.replace(/\.md$/, "")}\n\n`;
  if (ext === "json")
    return `{\n  \n}\n`;
  if (ext === "css")
    return `/* ${name} */\n\n`;
  return ``;
}
