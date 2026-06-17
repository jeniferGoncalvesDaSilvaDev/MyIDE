import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MONO =
  Platform.OS === "ios"
    ? "Menlo"
    : Platform.OS === "android"
    ? "monospace"
    : "monospace";

function getApiUrl(path: string): string {
  if (Platform.OS === "web") {
    return path;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

type LineType = "cmd" | "stdout" | "stderr" | "system" | "welcome";

interface TermLine {
  id: string;
  type: LineType;
  text: string;
  cwd?: string;
}

let _lid = 0;
function lid() {
  return String(++_lid);
}

const WELCOME: TermLine[] = [
  { id: lid(), type: "welcome", text: "─── Mobile IDE Terminal ───" },
  {
    id: lid(),
    type: "system",
    text: 'Type commands or "help" to see what\'s available.',
  },
  { id: lid(), type: "system", text: "" },
];

const HELP_TEXT = `Available commands:
  help            Show this help
  clear           Clear terminal output
  ls [path]       List files and dirs
  pwd             Print working directory
  cd <dir>        Change directory
  cat <file>      Print file contents
  mkdir <dir>     Create directory
  echo <text>     Print text
  node <file>     Run JavaScript
  python3 <file>  Run Python script
  bash <file>     Run shell script
  
Any other shell command is forwarded to the server.`;

const LINE_COLORS: Record<LineType, string> = {
  cmd: "#e6edf3",
  stdout: "#c9d1d9",
  stderr: "#f85149",
  system: "#6e7781",
  welcome: "#58a6ff",
};

function TermLineItem({ item }: { item: TermLine }) {
  const color = LINE_COLORS[item.type];
  if (!item.text) return <View style={{ height: 6 }} />;

  if (item.type === "cmd") {
    const cwd = item.cwd ?? "/home/runner/workspace";
    const short = cwd
      .replace("/home/runner/workspace", "~")
      .replace(/(.+)\/([^/]+\/[^/]+)$/, "…/$2");
    return (
      <View style={styles.cmdRow}>
        <Text style={[styles.mono, styles.prompt]} selectable={false}>
          {short} ${" "}
        </Text>
        <Text style={[styles.mono, { color }]} selectable>
          {item.text}
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.mono, { color }]} selectable>
      {item.text}
    </Text>
  );
}

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 78 : insets.bottom;

  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("/home/runner/workspace");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  function append(newLines: TermLine[]) {
    setLines((prev) => [...prev, ...newLines]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }

  const run = useCallback(
    async (rawCmd: string) => {
      const cmd = rawCmd.trim();
      if (!cmd) return;

      // Update history
      setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 100));
      setHistIdx(-1);
      setInput("");

      // Echo command
      append([{ id: lid(), type: "cmd", text: cmd, cwd }]);

      // Built-ins
      if (cmd === "clear") {
        setLines([]);
        return;
      }
      if (cmd === "help") {
        append([
          { id: lid(), type: "stdout", text: HELP_TEXT },
          { id: lid(), type: "system", text: "" },
        ]);
        return;
      }

      setRunning(true);
      try {
        const res = await fetch(getApiUrl("/api/terminal"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: cmd, cwd }),
        });

        if (!res.ok) {
          append([
            {
              id: lid(),
              type: "stderr",
              text: `Server error ${res.status} — is the API server running?`,
            },
            { id: lid(), type: "system", text: "" },
          ]);
          return;
        }

        const data = (await res.json()) as {
          stdout: string;
          stderr: string;
          exitCode: number;
          cwd: string;
        };

        const out: TermLine[] = [];
        if (data.stdout) {
          data.stdout
            .trimEnd()
            .split("\n")
            .forEach((l) => out.push({ id: lid(), type: "stdout", text: l }));
        }
        if (data.stderr) {
          data.stderr
            .trimEnd()
            .split("\n")
            .forEach((l) => out.push({ id: lid(), type: "stderr", text: l }));
        }
        out.push({ id: lid(), type: "system", text: "" });
        append(out);

        if (data.cwd && data.cwd !== cwd) setCwd(data.cwd);
      } catch (e: any) {
        append([
          {
            id: lid(),
            type: "stderr",
            text: `Connection error: ${e?.message ?? "failed to reach server"}`,
          },
          { id: lid(), type: "system", text: "" },
        ]);
      } finally {
        setRunning(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [cwd]
  );

  function onKeyPress(e: any) {
    if (e.nativeEvent.key === "ArrowUp") {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      if (history[idx] !== undefined) setInput(history[idx]);
    } else if (e.nativeEvent.key === "ArrowDown") {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : (history[idx] ?? ""));
    }
  }

  const shortCwd = cwd
    .replace("/home/runner/workspace", "~")
    .replace(/(.+)\/([^/]+\/[^/]+)$/, "…/$2");

  return (
    <View style={[styles.root, { backgroundColor: "#0d1117" }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, borderBottomColor: "#21262d" },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: "#ff5f57" }]} />
            <View style={[styles.dot, { backgroundColor: "#febc2e" }]} />
            <View style={[styles.dot, { backgroundColor: "#28c840" }]} />
          </View>
          <Text style={[styles.mono, styles.headerTitle]}>Terminal</Text>
          {running && (
            <View style={styles.runBadge}>
              <Text style={[styles.mono, { color: "#fff", fontSize: 10 }]}>
                running
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text
            style={[styles.mono, { color: "#3fb950", fontSize: 11 }]}
            numberOfLines={1}
          >
            {shortCwd}
          </Text>
          <TouchableOpacity
            onPress={() => setLines(WELCOME)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={15} color="#6e7781" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Output */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={topPad + 50}
      >
        <FlatList
          ref={listRef}
          data={lines}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <TermLineItem item={item} />}
          contentContainerStyle={styles.outputContent}
          showsVerticalScrollIndicator
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          keyboardShouldPersistTaps="handled"
          indicatorStyle="white"
        />

        {/* Input row */}
        <View
          style={[
            styles.inputRow,
            {
              paddingBottom: bottomPad + 6,
              borderTopColor: "#21262d",
              backgroundColor: "#161b22",
            },
          ]}
        >
          <Text style={[styles.mono, { color: "#3fb950", fontSize: 15 }]}>$</Text>
          <TextInput
            ref={inputRef}
            style={[styles.mono, styles.inputField]}
            value={input}
            onChangeText={setInput}
            placeholder="Enter command…"
            placeholderTextColor="#6e7781"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="send"
            onSubmitEditing={() => run(input)}
            onKeyPress={onKeyPress}
            editable={!running}
            selectionColor="#3fb950"
          />
          <TouchableOpacity
            onPress={() => run(input)}
            disabled={!input.trim() || running}
            style={[
              styles.runBtn,
              {
                backgroundColor:
                  input.trim() && !running ? "#238636" : "#21262d",
              },
            ]}
            activeOpacity={0.8}
          >
            <Feather
              name="corner-down-left"
              size={14}
              color={input.trim() && !running ? "#fff" : "#6e7781"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "flex-end",
  },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 5.5 },
  headerTitle: { color: "#c9d1d9", fontSize: 14, fontWeight: "700" },
  runBadge: {
    backgroundColor: "#1f6feb",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mono: { fontFamily: MONO },
  outputContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  cmdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 1,
  },
  prompt: {
    color: "#3fb950",
    fontSize: 13,
    lineHeight: 22,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputField: {
    flex: 1,
    color: "#e6edf3",
    fontSize: 13,
    paddingVertical: 8,
  },
  runBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
