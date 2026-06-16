import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIDE } from "@/context/IDEContext";
import { useColors } from "@/hooks/useColors";
import SyntaxHighlighter, { MONO_FONT } from "@/components/SyntaxHighlighter";
import Console, { LogEntry } from "@/components/Console";
import HtmlPreview from "@/components/HtmlPreview";

const LANG_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  markdown: "Markdown",
  bash: "Shell",
  yaml: "YAML",
  text: "Plain Text",
  java: "Java",
  ruby: "Ruby",
  php: "PHP",
  go: "Go",
  rust: "Rust",
  cpp: "C++",
  c: "C",
};

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f0db4f",
  python: "#3776ab",
  css: "#264de4",
  html: "#e34c26",
  json: "#5c9eb0",
  markdown: "#083fa1",
  bash: "#4eaa25",
  yaml: "#cb171e",
  text: "#888888",
  java: "#b07219",
  ruby: "#cc342d",
  php: "#777bb4",
  go: "#00add8",
  rust: "#dea584",
  cpp: "#f34b7d",
  c: "#555555",
};

// Languages handled as preview (not server execution)
const PREVIEW_LANGS = new Set(["html", "css"]);
// Languages that can't be run or previewed
const STATIC_LANGS = new Set(["markdown", "json", "yaml", "text"]);

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function buildCssPreviewHtml(css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Preview</title>
  <style>${css}</style>
</head>
<body>
  <h1>CSS Preview</h1>
  <p>This is a paragraph of sample text to preview your styles.</p>
  <p>Another paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
  <a href="#">A link element</a>
  <div class="card" style="margin-top:16px">
    <p>A div with class <code>card</code></p>
  </div>
  <button style="margin-top:16px">A button</button>
  <ul style="margin-top:16px">
    <li>List item one</li>
    <li>List item two</li>
    <li>List item three</li>
  </ul>
</body>
</html>`;
}

async function runCodeOnServer(
  code: string,
  language: string
): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  entries.push({
    id: makeId(),
    type: "system",
    text: `Running ${LANG_LABELS[language] ?? language}…`,
  });

  try {
    const res = await fetch(`${getBaseUrl()}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    });

    if (!res.ok) {
      entries.push({
        id: makeId(),
        type: "error",
        text: `Server error ${res.status}: ${await res.text()}`,
      });
      return entries;
    }

    const data = (await res.json()) as {
      stdout: string;
      stderr: string;
      exitCode: number;
    };

    if (data.stdout) {
      for (const line of data.stdout.trimEnd().split("\n")) {
        entries.push({ id: makeId(), type: "log", text: line });
      }
    }
    if (data.stderr) {
      for (const line of data.stderr.trimEnd().split("\n")) {
        entries.push({ id: makeId(), type: "error", text: line });
      }
    }
    if (!data.stdout && !data.stderr) {
      entries.push({ id: makeId(), type: "system", text: "(no output)" });
    }

    entries.push({
      id: makeId(),
      type: data.exitCode === 0 ? "system" : "error",
      text:
        data.exitCode === 0
          ? `✓ Exited with code 0`
          : `✗ Exited with code ${data.exitCode}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    entries.push({ id: makeId(), type: "error", text: `Connection error: ${msg}` });
  }

  return entries;
}

export default function EditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentFile, updateFileContent } = useIDE();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  function openEditor() {
    if (!currentFile) return;
    setEditContent(currentFile.content);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function saveFile() {
    if (!currentFile) return;
    await updateFileContent(currentFile.path, editContent);
    setEditing(false);
    setSaved(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleRun() {
    if (!currentFile) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // HTML / CSS → open preview
    if (PREVIEW_LANGS.has(currentFile.language)) {
      setPreviewVisible(true);
      return;
    }

    // Static files (markdown, json, yaml) → info message
    if (STATIC_LANGS.has(currentFile.language)) {
      setConsoleEntries([
        {
          id: makeId(),
          type: "warn",
          text: `${LANG_LABELS[currentFile.language]} is a markup/config file and cannot be executed.`,
        },
      ]);
      setConsoleVisible(true);
      return;
    }

    // Everything else → server execution
    setIsRunning(true);
    setConsoleVisible(true);
    setConsoleEntries([]);
    const entries = await runCodeOnServer(
      currentFile.content,
      currentFile.language
    );
    setConsoleEntries(entries);
    setIsRunning(false);
  }

  const lang = currentFile?.language ?? "text";
  const langLabel = LANG_LABELS[lang] ?? lang;
  const langColor = LANG_COLORS[lang] ?? "#888";
  const isPreviewable = PREVIEW_LANGS.has(lang);
  const isRunnable = !PREVIEW_LANGS.has(lang) && !STATIC_LANGS.has(lang);

  // Build HTML for preview
  const previewHtml =
    currentFile
      ? lang === "css"
        ? buildCssPreviewHtml(currentFile.content)
        : currentFile.content
      : "";

  if (!currentFile) {
    return (
      <View
        style={[
          styles.container,
          styles.empty,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <Feather name="code" size={52} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No file open
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
          Open a file from the Files tab
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[styles.filename, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {currentFile.name}
          </Text>
          <View
            style={[styles.langBadge, { backgroundColor: langColor + "20" }]}
          >
            <Text style={[styles.langBadgeText, { color: langColor }]}>
              {langLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {saved && (
            <View style={styles.savedIndicator}>
              <Feather name="check" size={13} color="#22c55e" />
              <Text style={[styles.savedText, { color: "#22c55e" }]}>
                Saved
              </Text>
            </View>
          )}

          {/* Run / Preview button */}
          <TouchableOpacity
            onPress={handleRun}
            style={[
              styles.actionBtn,
              {
                backgroundColor: isPreviewable
                  ? "#8b5cf6"
                  : isRunnable
                  ? "#22c55e"
                  : colors.secondary,
                borderColor: isPreviewable
                  ? "#8b5cf6"
                  : isRunnable
                  ? "#22c55e"
                  : colors.border,
              },
            ]}
            activeOpacity={0.75}
          >
            <Feather
              name={isPreviewable ? "eye" : "play"}
              size={13}
              color={isPreviewable || isRunnable ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionBtnText,
                {
                  color:
                    isPreviewable || isRunnable
                      ? "#fff"
                      : colors.mutedForeground,
                },
              ]}
            >
              {isPreviewable ? "Preview" : "Run"}
            </Text>
          </TouchableOpacity>

          {/* Edit button */}
          <TouchableOpacity
            onPress={openEditor}
            style={[
              styles.actionBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={13} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status bar */}
      <View
        style={[
          styles.statusBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.statusItem}>
          <View
            style={[styles.statusDot, { backgroundColor: langColor }]}
          />
          <Text
            style={[styles.statusText, { color: colors.mutedForeground }]}
          >
            {langLabel}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.split("\n").length} lines
        </Text>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.length} chars
        </Text>
        {!STATIC_LANGS.has(lang) && (
          <TouchableOpacity
            onPress={() => setConsoleVisible((v) => !v)}
            style={[
              styles.consoleToggle,
              consoleVisible && {
                backgroundColor: colors.primary + "20",
              },
            ]}
            activeOpacity={0.7}
          >
            <Feather
              name="terminal"
              size={12}
              color={
                consoleVisible ? colors.primary : colors.mutedForeground
              }
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: consoleVisible
                    ? colors.primary
                    : colors.mutedForeground,
                },
              ]}
            >
              Console
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Code + Console */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={[
            styles.codeArea,
            { backgroundColor: colors.background },
          ]}
          contentContainerStyle={{ paddingBottom: 24, paddingLeft: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <SyntaxHighlighter
            code={currentFile.content}
            language={currentFile.language}
            fontSize={13.5}
            showLineNumbers
          />
        </ScrollView>

        {consoleVisible && (
          <Console
            entries={consoleEntries}
            onClear={() => setConsoleEntries([])}
            isRunning={isRunning}
          />
        )}
      </View>

      {/* HTML/CSS Preview */}
      <HtmlPreview
        visible={previewVisible}
        html={previewHtml}
        title={currentFile.name}
        onClose={() => setPreviewVisible(false)}
      />

      {/* Edit modal */}
      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setEditing(false);
          setEditContent("");
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.editModal,
              {
                backgroundColor: colors.background,
                paddingTop: isWeb ? 67 : insets.top + 12,
              },
            ]}
          >
            <View
              style={[
                styles.editHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  setEditing(false);
                  setEditContent("");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cancelBtn,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={[styles.editTitle, { color: colors.foreground }]}
              >
                {currentFile.name}
              </Text>
              <TouchableOpacity onPress={saveFile} activeOpacity={0.8}>
                <Text
                  style={[styles.saveBtn, { color: colors.primary }]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={inputRef}
              style={[
                styles.codeInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              scrollEnabled
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  emptyHint: { fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1, gap: 5, marginRight: 8 },
  filename: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
    fontFamily: MONO_FONT,
  },
  langBadge: {
    alignSelf: "flex-start",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  langBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedIndicator: { flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { fontSize: 12, fontWeight: "600" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, fontFamily: MONO_FONT },
  consoleToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  codeArea: { flex: 1 },
  editModal: { flex: 1 },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { fontSize: 16 },
  editTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: MONO_FONT,
  },
  saveBtn: { fontSize: 16, fontWeight: "700" },
  codeInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13.5,
    lineHeight: 22,
    fontFamily: MONO_FONT,
  },
});
