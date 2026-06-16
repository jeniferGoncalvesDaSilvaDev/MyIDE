import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "./SyntaxHighlighter";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface Props {
  message: Message;
}

type Block =
  | { type: "text"; value: string }
  | { type: "code"; value: string; lang: string }
  | { type: "bold"; value: string }
  | { type: "inline_code"; value: string };

function parseContent(content: string): Block[] {
  const blocks: Block[] = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: "text", value: text });
    }
    blocks.push({
      type: "code",
      value: match[2].trimEnd(),
      lang: match[1] || "code",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) blocks.push({ type: "text", value: text });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", value: content }];
}

function renderTextWithMarkdown(text: string, textStyle: object) {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={[textStyle, { fontWeight: "700" }]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={i} style={[textStyle, styles.inlineCode]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

const LANG_DISPLAY: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  bash: "Shell",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  java: "Java",
  go: "Go",
  rust: "Rust",
  cpp: "C++",
  c: "C",
  code: "",
};

export default function ChatMessage({ message }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={styles.userWrapper}>
        <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
          <Text style={[styles.userText, { color: "#fff" }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const blocks = parseContent(message.content);
  const codeBg = isDark ? "#0d1117" : "#f6f8fa";
  const codeBorder = isDark ? "#30363d" : "#d0d7de";
  const codeText = isDark ? "#e6edf3" : "#1f2328";
  const textColor = colors.foreground;

  return (
    <View style={styles.assistantWrapper}>
      {/* Avatar + label */}
      <View style={styles.avatarRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>✦</Text>
        </View>
        <Text style={[styles.assistantName, { color: colors.primary }]}>
          Claude
        </Text>
        {message.isStreaming && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginLeft: 6 }}
          />
        )}
      </View>

      {/* Message content */}
      <View style={[styles.assistantCard, { backgroundColor: isDark ? "#161b22" : "#f6f8fa", borderColor: isDark ? "#30363d" : "#d0d7de" }]}>
        {blocks.map((block, idx) => {
          if (block.type === "code") {
            const langLabel = LANG_DISPLAY[block.lang] ?? block.lang;
            return (
              <View
                key={idx}
                style={[
                  styles.codeBlock,
                  { backgroundColor: codeBg, borderColor: codeBorder },
                  idx > 0 && { marginTop: 10 },
                ]}
              >
                {langLabel ? (
                  <View style={[styles.codeHeader, { borderBottomColor: codeBorder }]}>
                    <Text
                      style={[styles.langLabel, { color: isDark ? "#8b949e" : "#6e7781" }]}
                    >
                      {langLabel}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.codeText, { color: codeText }]}>
                  {block.value}
                </Text>
              </View>
            );
          }

          // Paragraph text — handle newlines
          const paragraphs = block.value.split(/\n\n+/);
          return (
            <View key={idx} style={idx > 0 ? { marginTop: 8 } : undefined}>
              {paragraphs.map((para, pIdx) => (
                <Text
                  key={pIdx}
                  style={[
                    styles.assistantText,
                    { color: textColor },
                    pIdx > 0 && { marginTop: 6 },
                  ]}
                >
                  {renderTextWithMarkdown(para, { color: textColor, fontSize: 15, lineHeight: 24 })}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userWrapper: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  userBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    borderBottomRightRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  assistantWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
    paddingLeft: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  assistantName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  assistantCard: {
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 24,
  },
  inlineCode: {
    fontFamily: MONO_FONT,
    fontSize: 13.5,
    backgroundColor: "rgba(127,127,127,0.15)",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  codeBlock: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  codeHeader: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  codeText: {
    fontFamily: MONO_FONT,
    fontSize: 12.5,
    lineHeight: 20,
    padding: 14,
  },
});
