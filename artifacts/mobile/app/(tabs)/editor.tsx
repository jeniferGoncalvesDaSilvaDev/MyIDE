import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
};

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3776ab",
  css: "#264de4",
  html: "#e34c26",
  json: "#5c9eb0",
  markdown: "#083fa1",
  bash: "#4eaa25",
  yaml: "#cb171e",
  text: "#888888",
};

const RUNNABLE = new Set(["typescript", "javascript"]);

function formatArg(arg: unknown): string {
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function stripTypeScript(code: string): string {
  let result = code;
  // Remove import statements
  result = result.replace(/^import\s+.*?(?:from\s+['"][^'"]*['"])?\s*;?\s*$/gm, "");
  // Remove export keywords (keep the declaration)
  result = result.replace(/^export\s+default\s+/gm, "");
  result = result.replace(/^export\s+/gm, "");
  // Remove interface declarations
  result = result.replace(/^(?:export\s+)?interface\s+\w[\w<>, ]*\s*\{[\s\S]*?\n\}/gm, "");
  // Remove type alias declarations
  result = result.replace(/^(?:export\s+)?type\s+\w+\s*=\s*[^;]+;/gm, "");
  // Remove access modifiers
  result = result.replace(/\b(public|private|protected|readonly)\s+/g, "");
  // Remove return type annotations
  result = result.replace(/\):\s*(?:Promise<[^>]*>|[A-Za-z<>\[\]|&]+)\s*(?=\{)/g, ") ");
  // Remove type annotations on variables/params  
  result = result.replace(/:\s*(?:string|number|boolean|any|void|never|object|unknown|null|undefined)(?:\[\])?\b/g, "");
  // Remove generic type parameters from functions/classes
  result = result.replace(/<[A-Z]\w*(?:,\s*[A-Z]\w*)*>/g, "");
  // Remove async keyword from main() calls but keep async functions
  return result;
}

function runJS(code: string, language: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const id = () => Date.now().toString() + Math.random().toString(36).slice(2, 6);

  const mockConsole = {
    log: (...args: unknown[]) =>
      entries.push({ id: id(), type: "log", text: args.map(formatArg).join(" ") }),
    error: (...args: unknown[]) =>
      entries.push({ id: id(), type: "error", text: args.map(formatArg).join(" ") }),
    warn: (...args: unknown[]) =>
      entries.push({ id: id(), type: "warn", text: args.map(formatArg).join(" ") }),
    info: (...args: unknown[]) =>
      entries.push({ id: id(), type: "info", text: args.map(formatArg).join(" ") }),
    dir: (...args: unknown[]) =>
      entries.push({ id: id(), type: "log", text: args.map(formatArg).join(" ") }),
    table: (data: unknown) =>
      entries.push({ id: id(), type: "log", text: formatArg(data) }),
  };

  let codeToRun = code;
  if (language === "typescript") {
    codeToRun = stripTypeScript(code);
  }

  entries.push({
    id: id(),
    type: "system",
    text: `Running ${language === "typescript" ? "TypeScript" : "JavaScript"}...`,
  });

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("console", codeToRun);
    const result = fn(mockConsole);
    if (result !== undefined) {
      entries.push({ id: id(), type: "result", text: formatArg(result) });
    }
    entries.push({ id: id(), type: "system", text: "✓ Execution complete" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    entries.push({ id: id(), type: "error", text: message });
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
  const inputRef = useRef<TextInput>(null);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

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

  function cancelEdit() {
    setEditing(false);
    setEditContent("");
  }

  async function handleRun() {
    if (!currentFile) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!RUNNABLE.has(currentFile.language)) {
      const id = Date.now().toString();
      setConsoleEntries([
        {
          id,
          type: "warn",
          text: `${LANG_LABELS[currentFile.language] ?? currentFile.language} cannot be executed on device.`,
        },
        {
          id: id + "1",
          type: "system",
          text: "Only JavaScript and TypeScript are supported.",
        },
      ]);
      setConsoleVisible(true);
      return;
    }

    setIsRunning(true);
    setConsoleVisible(true);
    setConsoleEntries([]);

    // Small delay to let the console panel open visually
    await new Promise((r) => setTimeout(r, 60));
    const entries = runJS(currentFile.content, currentFile.language);
    setConsoleEntries(entries);
    setIsRunning(false);
  }

  const langLabel = currentFile
    ? LANG_LABELS[currentFile.language] ?? currentFile.language
    : "";
  const langColor = currentFile
    ? LANG_COLORS[currentFile.language] ?? "#888"
    : "#888";
  const canRun = !!currentFile && RUNNABLE.has(currentFile.language);

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
          <View style={[styles.langBadge, { backgroundColor: langColor + "20" }]}>
            <Text style={[styles.langBadgeText, { color: langColor }]}>
              {langLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {saved && (
            <View style={styles.savedIndicator}>
              <Feather name="check" size={13} color={colors.primary} />
              <Text style={[styles.savedText, { color: colors.primary }]}>Saved</Text>
            </View>
          )}
          {/* Run button */}
          <TouchableOpacity
            onPress={handleRun}
            style={[
              styles.actionBtn,
              {
                backgroundColor: canRun ? "#22c55e" : colors.secondary,
                borderColor: canRun ? "#22c55e" : colors.border,
              },
            ]}
            activeOpacity={0.75}
          >
            <Feather
              name="play"
              size={13}
              color={canRun ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: canRun ? "#fff" : colors.mutedForeground },
              ]}
            >
              Run
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
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: langColor }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {langLabel}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.split("\n").length} lines
        </Text>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.length} chars
        </Text>
        {/* Console toggle */}
        <TouchableOpacity
          onPress={() => setConsoleVisible((v) => !v)}
          style={[
            styles.consoleToggle,
            consoleVisible && { backgroundColor: colors.primary + "20" },
          ]}
          activeOpacity={0.7}
        >
          <Feather
            name="terminal"
            size={12}
            color={consoleVisible ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.statusText,
              { color: consoleVisible ? colors.primary : colors.mutedForeground },
            ]}
          >
            Console
          </Text>
        </TouchableOpacity>
      </View>

      {/* Code area + Console */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={[styles.codeArea, { backgroundColor: colors.background }]}
          contentContainerStyle={{
            paddingBottom: 24,
            paddingLeft: 4,
          }}
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

      {/* Edit modal */}
      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancelEdit}
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
              <TouchableOpacity onPress={cancelEdit} activeOpacity={0.7}>
                <Text style={[styles.cancelBtn, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.editTitle, { color: colors.foreground }]}>
                {currentFile.name}
              </Text>
              <TouchableOpacity onPress={saveFile} activeOpacity={0.8}>
                <Text style={[styles.saveBtn, { color: colors.primary }]}>
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
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
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
  headerLeft: { flex: 1, gap: 6, marginRight: 8 },
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
  savedText: { fontSize: 13, fontWeight: "500" },
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
  editTitle: { fontSize: 15, fontWeight: "600", fontFamily: MONO_FONT },
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
