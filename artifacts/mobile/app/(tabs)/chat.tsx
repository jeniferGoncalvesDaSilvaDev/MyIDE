import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { useRouter } from "expo-router";
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { useIDE } from "@/context/IDEContext";
import { useColors } from "@/hooks/useColors";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

const SUGGESTIONS = [
  { icon: "search", text: "Explain this code" },
  { icon: "zap", text: "Fix bugs" },
  { icon: "edit-3", text: "Refactor" },
  { icon: "check-square", text: "Write tests" },
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentFile, apiKey } = useIDE();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  function buildSystemPrompt(): string {
    if (!currentFile) {
      return "You are an expert coding assistant similar to Cursor AI. Help the user with coding questions, explain concepts, suggest improvements, and write code. Be concise and use markdown code blocks.";
    }
    return `You are an expert coding assistant similar to Cursor AI. The user has this file open:

**${currentFile.name}** (${currentFile.language})

\`\`\`${currentFile.language}
${currentFile.content.slice(0, 4000)}${currentFile.content.length > 4000 ? "\n// ... (truncated)" : ""}
\`\`\`

Help them understand, improve, or extend this code. Be concise and practical.`;
  }

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || isLoading) return;

      if (!apiKey) {
        const noKeyMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "Please add your Anthropic API key in the **Settings** tab to use the AI assistant.\n\nGet a free key at **console.anthropic.com**",
        };
        setMessages((prev) => [noKeyMsg, ...prev]);
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageText,
      };

      const streamingId = (Date.now() + 1).toString();
      const streamingMsg: Message = {
        id: streamingId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [streamingMsg, userMsg, ...prev]);
      setInput("");
      setIsLoading(true);

      const history = messages
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: messageText });

      let aborted = false;
      abortRef.current = () => {
        aborted = true;
      };

      try {
        const response = await fetch(`${getBaseUrl()}/api/ai/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anthropic-key": apiKey,
          },
          body: JSON.stringify({
            messages: history,
            systemPrompt: buildSystemPrompt(),
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              if (parsed.content) {
                accumulated += parsed.content;
                const snap = accumulated;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingId
                      ? { ...m, content: snap, isStreaming: true }
                      : m
                  )
                );
              }
            } catch {}
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err: any) {
        const errMsg = err?.message?.includes("401")
          ? "Invalid API key — check your key in **Settings**."
          : "Connection error. Make sure the server is running.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? { ...m, content: errMsg, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [input, isLoading, messages, apiKey, currentFile]
  );

  function clearChat() {
    abortRef.current?.();
    setMessages([]);
    setIsLoading(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 10,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.modelBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
            <Text style={[styles.modelBadgeText, { color: colors.primary }]}>✦ Claude</Text>
          </View>
          {currentFile && (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/editor")}
              activeOpacity={0.7}
              style={[styles.contextPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Feather name="file-text" size={11} color={colors.mutedForeground} />
              <Text style={[styles.contextPillText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {currentFile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="rotate-ccw" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatMessage message={item} />}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={
            messages.length === 0 ? (
              <View style={styles.emptyState}>
                {/* Big glow icon */}
                <View style={[styles.emptyGlow, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={styles.emptyEmoji}>✦</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  AI Code Assistant
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {currentFile
                    ? `Ask about ${currentFile.name} or anything else`
                    : "Ask me to write, explain, or debug code"}
                </Text>

                {/* Suggestion chips */}
                <View style={styles.suggestionGrid}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s.text}
                      onPress={() => sendMessage(s.text)}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Feather name={s.icon as any} size={14} color={colors.primary} />
                      <Text style={[styles.suggestionText, { color: colors.foreground }]}>
                        {s.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* ── Input bar ── */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: isLoading ? colors.primary + "60" : colors.border },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder={isLoading ? "Claude is thinking…" : "Ask about your code…"}
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!isLoading}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
            />
            <TouchableOpacity
              onPress={isLoading ? () => abortRef.current?.() : () => sendMessage()}
              disabled={!isLoading && !input.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: isLoading
                    ? "#ef4444"
                    : input.trim()
                    ? colors.primary
                    : colors.secondary,
                },
              ]}
              activeOpacity={0.8}
            >
              <Feather
                name={isLoading ? "square" : "arrow-up"}
                size={15}
                color={input.trim() || isLoading ? "#fff" : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
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
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  modelBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  modelBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    maxWidth: 150,
  },
  contextPillText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  messageList: {
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 14,
  },
  emptyGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
  suggestionGrid: {
    width: "100%",
    marginTop: 8,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 18,
    borderWidth: 1.5,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});
