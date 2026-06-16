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

function parseContent(content: string): Array<{ type: "text" | "code"; value: string; lang?: string }> {
  const blocks: Array<{ type: "text" | "code"; value: string; lang?: string }> = [];
  const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: "text", value: text });
    }
    blocks.push({ type: "code", value: match[2], lang: match[1] || "text" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) blocks.push({ type: "text", value: text });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", value: content }];
}

export default function ChatMessage({ message }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={[styles.userWrapper]}>
        <View
          style={[
            styles.userBubble,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[styles.userText, { color: colors.primaryForeground }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  const blocks = parseContent(message.content);

  return (
    <View style={styles.assistantWrapper}>
      <View
        style={[
          styles.assistantBadge,
          { backgroundColor: colors.primary + "20", borderColor: colors.primary + "30" },
        ]}
      >
        <Text style={[styles.assistantLabel, { color: colors.primary }]}>
          Claude
        </Text>
      </View>

      <View style={styles.assistantContent}>
        {blocks.map((block, idx) => {
          if (block.type === "code") {
            return (
              <View
                key={idx}
                style={[
                  styles.codeBlock,
                  {
                    backgroundColor: scheme === "dark" ? "#161b22" : "#f6f8fa",
                    borderColor: colors.border,
                  },
                ]}
              >
                {block.lang && (
                  <Text style={[styles.langLabel, { color: colors.mutedForeground }]}>
                    {block.lang}
                  </Text>
                )}
                <Text
                  style={[
                    styles.codeText,
                    { color: scheme === "dark" ? "#e6edf3" : "#1f2328" },
                  ]}
                >
                  {block.value}
                </Text>
              </View>
            );
          }
          return (
            <Text
              key={idx}
              style={[styles.assistantText, { color: colors.foreground }]}
            >
              {block.value}
            </Text>
          );
        })}

        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userWrapper: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  userBubble: {
    maxWidth: "80%",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  assistantBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginBottom: 6,
  },
  assistantLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  assistantContent: {
    gap: 10,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 24,
  },
  codeBlock: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
  },
  langLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  codeText: {
    fontFamily: MONO_FONT,
    fontSize: 12.5,
    lineHeight: 19,
  },
  streamingIndicator: {
    paddingTop: 4,
    paddingLeft: 2,
  },
});
