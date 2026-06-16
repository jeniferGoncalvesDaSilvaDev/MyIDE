import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "./SyntaxHighlighter";

export interface LogEntry {
  id: string;
  type: "log" | "error" | "warn" | "info" | "result" | "system";
  text: string;
}

interface Props {
  entries: LogEntry[];
  onClear: () => void;
  isRunning: boolean;
}

const ENTRY_COLORS = {
  log: { dark: "#e6edf3", light: "#1f2328" },
  info: { dark: "#79c0ff", light: "#0550ae" },
  warn: { dark: "#f2cc60", light: "#9a6700" },
  error: { dark: "#f85149", light: "#cf222e" },
  result: { dark: "#7ee787", light: "#1a7f37" },
  system: { dark: "#8b949e", light: "#6e7781" },
};

const ENTRY_PREFIXES: Record<string, string> = {
  log: "  ",
  info: "ℹ ",
  warn: "⚠ ",
  error: "✕ ",
  result: "← ",
  system: "$ ",
};

export default function Console({ entries, onClear, isRunning }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const bg = isDark ? "#0d1117" : "#f6f8fa";

  return (
    <View style={[styles.container, { backgroundColor: bg, borderTopColor: colors.border }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <View style={styles.toolbarLeft}>
          <View style={[styles.dot, { backgroundColor: "#f85149" }]} />
          <View style={[styles.dot, { backgroundColor: "#f2cc60" }]} />
          <View style={[styles.dot, { backgroundColor: "#7ee787" }]} />
          <Text style={[styles.toolbarLabel, { color: colors.mutedForeground }]}>
            Console
          </Text>
        </View>
        <View style={styles.toolbarRight}>
          {isRunning && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
          {entries.length > 0 && (
            <TouchableOpacity onPress={onClear} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.output}
        contentContainerStyle={styles.outputContent}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 && !isRunning ? (
          <Text style={[styles.placeholder, { color: colors.mutedForeground }]}>
            Run your code to see output here
          </Text>
        ) : (
          entries.map((entry) => {
            const colorSet = ENTRY_COLORS[entry.type];
            const color = isDark ? colorSet.dark : colorSet.light;
            const prefix = ENTRY_PREFIXES[entry.type] ?? "  ";
            return (
              <Text key={entry.id} style={[styles.logLine, { color }]}>
                {prefix}{entry.text}
              </Text>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 220,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginLeft: 6,
    fontFamily: MONO_FONT,
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  output: {
    flex: 1,
  },
  outputContent: {
    padding: 10,
    paddingLeft: 14,
    gap: 2,
  },
  placeholder: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    fontStyle: "italic",
    paddingTop: 4,
  },
  logLine: {
    fontSize: 12.5,
    lineHeight: 20,
    fontFamily: MONO_FONT,
  },
});
