import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

const MONO =
  Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "monospace";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

type LineType = "cmd" | "stdout" | "stderr" | "system" | "welcome";

interface TermLine {
  id: string;
  type: LineType;
  text: string;
  cwd?: string;
}

let _lineId = 0;
function lid() {
  return String(++_lineId);
}

const WELCOME: TermLine[] = [
  {
    id: lid(),
    type: "welcome",
    text: "Mobile IDE Terminal",
  },
  {
    id: lid(),
    type: "system",
    text: 'Type "help" for available commands. Working dir: ~/workspace',
  },
  { id: lid(), type: "system", text: "" },
];

const BUILT_IN_HELP = `Built-in commands:
  clear         Clear terminal output
  help          Show this help
  ls            List files
  pwd           Print working directory
  cd <dir>      Change directory
  cat <file>    Print file contents
  echo <text>   Print text
  python3 <f>   Run Python script
  node <f>      Run JS file
  bash <f>      Run shell script`;

const LINE_COLORS: Record<LineType, string> = {
  cmd: "#e6edf3",
  stdout: "#c9d1d9",
  stderr: "#f85149",
  system: "#6e7781",
  welcome: "#58a6ff",
};

function TermLineView({ item }: { item: TermLine }) {
  const color = LINE_COLORS[item.type];

  if (item.type === "cmd") {
    // Show prompt + command
    const cwd = item.cwd ?? "/home/runner/workspace";
    const shortCwd = cwd.replace("/home/runner/workspace", "~").replace(/.*\/(.+\/.+)$/, "$1");
    return (
      <View style={styles.cmdRow}>
        <Text style={[styles.prompt, { color: "#3fb950" }]}>
          {shortCwd} ${"  "}
        </Text>
        <Text style={[styles.line, { color }]}>{item.text}</Text>
      </View>
    );
  }

  if (!item.text) return <View style={{ height: 8 }} />;

  return (
    <Text style={[styles.line, { color }]} selectable>
      {item.text}
    </Text>
  );
}

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("/home/runner/workspace");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  function addLines(newLines: TermLine[]) {
    setLines((prev) => [...prev, ...newLines]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  const runCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      // Add to history
      setHistory((h) => {
        const next = [trimmed, ...h.filter((x) => x !== trimmed)].slice(0, 50);
        return next;
      });
      setHistIdx(-1);
      setInput("");

      // Echo the command
      addLines([{ id: lid(), type: "cmd", text: trimmed, cwd }]);

      // Built-in: clear
      if (trimmed === "clear") {
        setLines([]);
        return;
      }

      // Built-in: help
      if (trimmed === "help") {
        addLines([
          { id: lid(), type: "stdout", text: BUILT_IN_HELP },
          { id: lid(), type: "system", text: "" },
        ]);
        return;
      }

      // Send to server
      setRunning(true);
      try {
        const res = await fetch(`${getBaseUrl()}/api/terminal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: trimmed, cwd }),
        });

        if (!res.ok) {
          addLines([
            {
              id: lid(),
              type: "stderr",
              text: `Server error: ${res.status}`,
            },
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
          for (const l of data.stdout.trimEnd().split("\n")) {
            out.push({ id: lid(), type: "stdout", text: l });
          }
        }
        if (data.stderr) {
          for (const l of data.stderr.trimEnd().split("\n")) {
            out.push({ id: lid(), type: "stderr", text: l });
          }
        }
        if (!data.stdout && !data.stderr) {
          // Successful silent command — no output
        }
        out.push({ id: lid(), type: "system", text: "" });
        addLines(out);

        if (data.cwd && data.cwd !== cwd) {
          setCwd(data.cwd);
        }
      } catch (err: any) {
        addLines([
          {
            id: lid(),
            type: "stderr",
            text: `Connection error: ${err?.message ?? "unknown"}`,
          },
          { id: lid(), type: "system", text: "" },
        ]);
      } finally {
        setRunning(false);
      }
    },
    [cwd]
  );

  function handleKeyPress(e: any) {
    if (e.nativeEvent.key === "ArrowUp") {
      const nextIdx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(nextIdx);
      if (history[nextIdx]) setInput(history[nextIdx]);
    } else if (e.nativeEvent.key === "ArrowDown") {
      const nextIdx = Math.max(histIdx - 1, -1);
      setHistIdx(nextIdx);
      setInput(nextIdx === -1 ? "" : history[nextIdx] ?? "");
    }
  }

  const shortCwd = cwd
    .replace("/home/runner/workspace", "~")
    .replace(/.*\/(.+\/.+)$/, "...$1");

  return (
    <View style={[styles.container, { backgroundColor: "#0d1117" }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            borderBottomColor: "#21262d",
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.termDots}>
            <View style={[styles.dot, { backgroundColor: "#ff5f57" }]} />
            <View style={[styles.dot, { backgroundColor: "#febc2e" }]} />
            <View style={[styles.dot, { backgroundColor: "#28c840" }]} />
          </View>
          <Text style={styles.headerTitle}>Terminal</Text>
          {running && (
            <View style={styles.runningBadge}>
              <Text style={styles.runningText}>running</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.cwdText} numberOfLines={1}>
            {shortCwd}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setLines([]);
              addLines(WELCOME);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={16} color="#6e7781" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Terminal body */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={lines}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <TermLineView item={item} />}
          style={styles.output}
          contentContainerStyle={styles.outputContent}
          showsVerticalScrollIndicator
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          keyboardShouldPersistTaps="handled"
        />

        {/* Input row */}
        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: "#21262d",
              paddingBottom: bottomPad + 8,
              backgroundColor: "#161b22",
            },
          ]}
        >
          <Text style={styles.inputPrompt}>$</Text>
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={input}
            onChangeText={setInput}
            placeholder="Enter command…"
            placeholderTextColor="#6e7781"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="send"
            onSubmitEditing={() => runCommand(input)}
            onKeyPress={handleKeyPress}
            editable={!running}
          />
          <TouchableOpacity
            onPress={() => runCommand(input)}
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
              size={15}
              color={input.trim() && !running ? "#fff" : "#6e7781"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  termDots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  headerTitle: {
    color: "#c9d1d9",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: MONO,
  },
  runningBadge: {
    backgroundColor: "#1f6feb",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  runningText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: MONO,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "flex-end",
  },
  cwdText: {
    color: "#3fb950",
    fontSize: 11,
    fontFamily: MONO,
    maxWidth: 180,
  },
  output: {
    flex: 1,
  },
  outputContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  cmdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 2,
  },
  prompt: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  line: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputPrompt: {
    color: "#3fb950",
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: "700",
  },
  inputField: {
    flex: 1,
    color: "#e6edf3",
    fontFamily: MONO,
    fontSize: 13,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  runBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
